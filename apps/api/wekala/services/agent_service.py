"""AgentService — business logic for the agent lifecycle.

State machine (enforced here, not in the DB):
  DRAFT → PUBLISHED  (publish)
  DRAFT → ARCHIVED   (archive)
  PUBLISHED → ARCHIVED (archive)
  Any → new DRAFT    (rollback — non-destructive; creates new version)
  ARCHIVED → *       FORBIDDEN

All state-changing methods write an audit log entry as fire-and-forget.
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.agent_runtime.base import AgentRuntime
from wekala.core.config import settings

if TYPE_CHECKING:
    from wekala.services.bazaar_service import BazaarService
from wekala.core.constants import (
    Action,
    AgentSource,
    AgentStatus,
    Classification,
    Outcome,
    ResourceType,
)
from wekala.core.utils.yaml_validator import validate_yaml
from wekala.db.models import Agent
from wekala.db.repositories.agent import AgentRepository
from wekala.db.repositories.agent_import import AgentImportRepository
from wekala.db.repositories.agent_version import AgentVersionRepository
from wekala.db.repositories.audit import AuditRepository

_ALLOWED_TRANSITIONS: dict[AgentStatus, set[AgentStatus]] = {
    AgentStatus.DRAFT: {AgentStatus.PUBLISHED, AgentStatus.ARCHIVED},
    AgentStatus.IN_REVIEW: {AgentStatus.PUBLISHED, AgentStatus.ARCHIVED},
    AgentStatus.PUBLISHED: {AgentStatus.ARCHIVED},
    AgentStatus.ARCHIVED: set(),
}


class AgentService:
    def __init__(self, db: AsyncSession, runtime: AgentRuntime) -> None:
        self._db = db
        self._runtime = runtime
        self._agents = AgentRepository(db)
        self._versions = AgentVersionRepository(db)
        self._imports = AgentImportRepository(db)
        self._audit = AuditRepository(db)

    # ------------------------------------------------------------------
    # Import / Create
    # ------------------------------------------------------------------

    async def import_from_yaml(
        self,
        *,
        workspace_id: uuid.UUID,
        owner_id: uuid.UUID,
        raw_yaml: bytes,
        filename: str,
    ) -> Agent:
        """Parse, validate, and register a Dify DSL YAML upload.

        On success: inserts agent + agent_version + agent_import (success).
        On failure: inserts agent_import (failed) and raises HTTP 422.
        O(s) where s = YAML size ≤ 1 MiB.
        """
        dsl, errors = validate_yaml(
            raw_yaml,
            workspace_tool_ids=frozenset(),  # Phase 2: no tools registered yet
        )

        if errors:
            async with self._db.begin_nested():
                await self._imports.record(
                    workspace_id=workspace_id,
                    imported_by=owner_id,
                    source=AgentSource.YAML_UPLOAD,
                    status="failed",
                    filename=filename,
                    raw_yaml=raw_yaml.decode(errors="replace"),
                    error_msg="; ".join(errors),
                )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"errors": errors},
            )

        app_name = dsl["app"]["name"]
        app_description = dsl.get("app", {}).get("description", "")

        async with self._db.begin_nested():
            agent = await self._agents.create(
                workspace_id=workspace_id,
                name=app_name,
                description=app_description,
                owner_id=owner_id,
                tags=[],
                classification=Classification.INTERNAL,
                language="en",
                dify_dsl=dsl,
            )
            await self._versions.create(
                agent_id=agent.id,
                version_num=1,
                name=app_name,
                description=app_description,
                dify_dsl=dsl,
                changed_by=owner_id,
                change_note="Initial import",
            )
            await self._imports.record(
                workspace_id=workspace_id,
                imported_by=owner_id,
                source=AgentSource.YAML_UPLOAD,
                status="success",
                agent_id=agent.id,
                filename=filename,
                raw_yaml=raw_yaml.decode(errors="replace"),
            )
            await self._audit.record(
                action=Action.AGENT_CREATE,
                outcome=Outcome.SUCCESS,
                actor_user_id=owner_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
            )

        return agent

    async def import_from_template(
        self,
        *,
        workspace_id: uuid.UUID,
        owner_id: uuid.UUID,
        template_id: str,
        templates: dict[str, dict],  # type: ignore[type-arg]
    ) -> Agent:
        """Create agent from a built-in template. O(1)."""
        template = templates.get(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template '{template_id}' not found",
            )

        dsl = template["dsl"]
        app_name = dsl.get("app", {}).get("name", template_id)
        description = template.get("description", "")

        async with self._db.begin_nested():
            agent = await self._agents.create(
                workspace_id=workspace_id,
                name=app_name,
                description=description,
                owner_id=owner_id,
                tags=[],
                classification=Classification.INTERNAL,
                language="en",
                dify_dsl=dsl,
            )
            await self._versions.create(
                agent_id=agent.id,
                version_num=1,
                name=app_name,
                description=description,
                dify_dsl=dsl,
                changed_by=owner_id,
                change_note=f"Created from template '{template_id}'",
            )
            await self._imports.record(
                workspace_id=workspace_id,
                imported_by=owner_id,
                source=AgentSource.TEMPLATE,
                status="success",
                agent_id=agent.id,
                filename=template_id,
            )
            await self._audit.record(
                action=Action.AGENT_CREATE,
                outcome=Outcome.SUCCESS,
                actor_user_id=owner_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
            )

        return agent

    # ------------------------------------------------------------------
    # Update (draft only)
    # ------------------------------------------------------------------

    async def update(
        self,
        *,
        agent: Agent,
        actor_id: uuid.UUID,
        name: str | None = None,
        description: str | None = None,
        dify_dsl: dict | None = None,  # type: ignore[type-arg]
        change_note: str = "",
    ) -> Agent:
        """Update a draft agent. Creates a new version snapshot. O(1)."""
        if agent.status != AgentStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only draft agents can be edited",
            )

        new_version_num = await self._versions.next_version_num(agent.id)
        new_name = name if name is not None else agent.name
        new_description = description if description is not None else agent.description
        new_dsl = dify_dsl if dify_dsl is not None else {}

        async with self._db.begin_nested():
            await self._versions.create(
                agent_id=agent.id,
                version_num=new_version_num,
                name=new_name,
                description=new_description,
                dify_dsl=new_dsl,
                changed_by=actor_id,
                change_note=change_note,
            )
            fields: dict[str, object] = {"version": new_version_num}
            if name is not None:
                fields["name"] = name
            if description is not None:
                fields["description"] = description
            agent = await self._agents.update(agent, **fields)
            await self._audit.record(
                action=Action.AGENT_UPDATE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=agent.workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
                metadata={"version": new_version_num},
            )

        return agent

    # ------------------------------------------------------------------
    # State transitions
    # ------------------------------------------------------------------

    async def publish(
        self,
        *,
        agent: Agent,
        actor_id: uuid.UUID,
        bazaar_svc: BazaarService | None = None,
        background_tasks: BackgroundTasks | None = None,
    ) -> Agent:
        """DRAFT / IN_REVIEW → PUBLISHED. O(1).

        If bazaar_svc + background_tasks are provided, indexes the agent
        into Meilisearch as a fire-and-forget background task.
        """
        self._assert_transition(agent, AgentStatus.PUBLISHED)

        async with self._db.begin_nested():
            agent = await self._agents.update(agent, status=AgentStatus.PUBLISHED)
            await self._audit.record(
                action=Action.AGENT_PUBLISH,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=agent.workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
            )

        if bazaar_svc and background_tasks:
            background_tasks.add_task(bazaar_svc.index_agent, agent)

        return agent

    async def archive(
        self,
        *,
        agent: Agent,
        actor_id: uuid.UUID,
        bazaar_svc: BazaarService | None = None,
        background_tasks: BackgroundTasks | None = None,
    ) -> Agent:
        """DRAFT / PUBLISHED → ARCHIVED. O(1).

        If bazaar_svc + background_tasks are provided, removes the agent
        from the Meilisearch index as a fire-and-forget background task.
        """
        self._assert_transition(agent, AgentStatus.ARCHIVED)

        async with self._db.begin_nested():
            agent = await self._agents.update(agent, status=AgentStatus.ARCHIVED)
            await self._audit.record(
                action=Action.AGENT_ARCHIVE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=agent.workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
            )

        if bazaar_svc and background_tasks:
            background_tasks.add_task(bazaar_svc.deindex_agent, agent.id)

        return agent

    async def rollback(self, *, agent: Agent, actor_id: uuid.UUID, version_num: int) -> Agent:
        """Create a new DRAFT from a previous version snapshot. Non-destructive. O(1)."""
        snap = await self._versions.get(agent.id, version_num)
        if not snap:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {version_num} not found",
            )

        new_version_num = await self._versions.next_version_num(agent.id)

        async with self._db.begin_nested():
            await self._versions.create(
                agent_id=agent.id,
                version_num=new_version_num,
                name=snap.name,
                description=snap.description,
                dify_dsl=snap.dify_dsl,
                changed_by=actor_id,
                change_note=f"Rollback from version {version_num}",
            )
            agent = await self._agents.update(
                agent,
                status=AgentStatus.DRAFT,
                version=new_version_num,
                name=snap.name,
                description=snap.description,
            )
            await self._audit.record(
                action=Action.AGENT_UPDATE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=agent.workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
                metadata={"rollback_from": version_num, "new_version": new_version_num},
            )

        return agent

    async def clone(self, *, agent: Agent, actor_id: uuid.UUID, workspace_id: uuid.UUID) -> Agent:
        """Fork an agent into a new DRAFT in the same workspace. O(1)."""
        latest_version = await self._versions.get(agent.id, agent.version)
        dsl = latest_version.dify_dsl if latest_version else {}

        async with self._db.begin_nested():
            clone = await self._agents.create(
                workspace_id=workspace_id,
                name=f"{agent.name} (copy)",
                description=agent.description,
                owner_id=actor_id,
                tags=list(agent.tags),
                classification=agent.classification,
                language=agent.language,
                dify_dsl=dsl,
            )
            await self._versions.create(
                agent_id=clone.id,
                version_num=1,
                name=clone.name,
                description=clone.description,
                dify_dsl=dsl,
                changed_by=actor_id,
                change_note=f"Cloned from agent {agent.id}",
            )
            await self._audit.record(
                action=Action.AGENT_CLONE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=clone.id,
                metadata={"source_agent_id": str(agent.id)},
            )

        return clone

    async def transfer(
        self, *, agent: Agent, actor_id: uuid.UUID, new_owner_id: uuid.UUID
    ) -> Agent:
        """Change agent owner. Admin only (enforced by OPA at endpoint layer). O(1)."""
        async with self._db.begin_nested():
            prev_owner = agent.owner_id
            agent = await self._agents.update(agent, owner_id=new_owner_id)
            await self._audit.record(
                action=Action.AGENT_TRANSFER,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=agent.workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
                metadata={"from_owner": str(prev_owner), "to_owner": str(new_owner_id)},
            )

        return agent

    # ------------------------------------------------------------------
    # Sandbox test
    # ------------------------------------------------------------------

    async def test_sandbox(
        self,
        *,
        agent: Agent,
        actor_id: uuid.UUID,
        query: str,
    ) -> dict:  # type: ignore[type-arg]
        """Invoke agent in sandbox. Enforces daily quota. O(log n) quota check."""
        uses_today = await self._agents.count_sandbox_uses_today(actor_id, agent.workspace_id)
        if uses_today >= settings.agent_sandbox_daily_quota:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Sandbox quota reached: {settings.agent_sandbox_daily_quota}"
                    " invocations per day"
                ),
            )

        if not agent.dify_app_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Agent is not registered with Dify yet",
            )

        result = await self._runtime.invoke_sandbox(
            app_id=agent.dify_app_id,
            query=query,
            user_id=str(actor_id),
        )

        await self._audit.record(
            action=Action.AGENT_TEST,
            outcome=Outcome.SUCCESS,
            actor_user_id=actor_id,
            actor_workspace_id=agent.workspace_id,
            resource_type=ResourceType.AGENT,
            resource_id=agent.id,
        )

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _assert_transition(self, agent: Agent, target: AgentStatus) -> None:
        current = AgentStatus(agent.status)
        allowed = _ALLOWED_TRANSITIONS.get(current, set())
        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition from {current} to {target}",
            )
