"""Agent lifecycle endpoints.

All endpoints are workspace-scoped.
Auth enforced via require_workspace_role (same pattern as workspaces.py).
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Annotated

import yaml
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.agent_runtime.dify import DifyAdapter
from wekala.adapters.auth.base import UserResult
from wekala.api.deps import get_current_user, require_workspace_role
from wekala.core.config import settings
from wekala.core.constants import Role
from wekala.db.models import Agent, AgentVersion
from wekala.db.repositories.agent import AgentRepository
from wekala.db.repositories.agent_version import AgentVersionRepository
from wekala.db.session import get_db
from wekala.services.agent_service import AgentService

router = APIRouter()

_YAML_MAX_BYTES = 1_048_576  # 1 MiB — also enforced in yaml_validator but checked here first


# ---------------------------------------------------------------------------
# Template loader (runs once at startup, cached in module scope)
# ---------------------------------------------------------------------------


def _load_templates() -> dict[str, dict]:  # type: ignore[type-arg]
    """Load all YAML files from the templates/ directory. O(t) where t = template count."""
    templates: dict[str, dict] = {}  # type: ignore[type-arg]
    templates_dir = Path(__file__).parent.parent.parent / "templates"
    if not templates_dir.is_dir():
        return templates
    for path in templates_dir.glob("*.yaml"):
        try:
            with path.open("rb") as f:
                dsl = yaml.safe_load(f)
            template_id = path.stem
            templates[template_id] = {
                "id": template_id,
                "name": dsl.get("app", {}).get("name", template_id),
                "description": dsl.get("app", {}).get("description", ""),
                "dsl": dsl,
            }
        except Exception:
            pass  # Skip malformed template files silently at startup
    return templates


_TEMPLATES: dict[str, dict] = _load_templates()  # type: ignore[type-arg]


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AgentOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str
    owner_id: uuid.UUID
    tags: list[str]
    status: str
    version: int
    language: str
    classification: str
    vetting_status: str
    dify_app_id: str | None
    created_at: str
    updated_at: str

    @classmethod
    def from_orm(cls, a: Agent) -> AgentOut:
        return cls(
            id=a.id,
            workspace_id=a.workspace_id,
            name=a.name,
            description=a.description,
            owner_id=a.owner_id,
            tags=list(a.tags),
            status=a.status,
            version=a.version,
            language=a.language,
            classification=a.classification,
            vetting_status=a.vetting_status,
            dify_app_id=a.dify_app_id,
            created_at=a.created_at.isoformat(),
            updated_at=a.updated_at.isoformat(),
        )


class AgentVersionOut(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    version_num: int
    name: str
    description: str
    changed_by: uuid.UUID
    change_note: str
    created_at: str

    @classmethod
    def from_orm(cls, v: AgentVersion) -> AgentVersionOut:
        return cls(
            id=v.id,
            agent_id=v.agent_id,
            version_num=v.version_num,
            name=v.name,
            description=v.description,
            changed_by=v.changed_by,
            change_note=v.change_note,
            created_at=v.created_at.isoformat(),
        )


class AgentListOut(BaseModel):
    items: list[AgentOut]
    total: int
    page: int
    size: int


class UpdateAgentIn(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    change_note: str = ""


class TransferAgentIn(BaseModel):
    new_owner_id: uuid.UUID


class ImportFromTemplateIn(BaseModel):
    template_id: str


class TestAgentIn(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


class TemplateOut(BaseModel):
    id: str
    name: str
    description: str


# ---------------------------------------------------------------------------
# Dependency: resolve agent within the caller's workspace
# ---------------------------------------------------------------------------


async def _get_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Agent:
    repo = AgentRepository(db)
    agent = await repo.get(agent_id, workspace_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


def _runtime() -> DifyAdapter:
    return DifyAdapter()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/workspaces/{workspace_id}/agents", response_model=AgentListOut)
async def list_agents(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status_filter: str | None = None,
    page: int = 1,
    size: int = 20,
) -> AgentListOut:
    """List agents in workspace, paginated. O(log n) via composite index."""
    if size > 100:
        size = 100
    repo = AgentRepository(db)
    items, total = await repo.list(workspace_id, status=status_filter, page=page, size=size)
    return AgentListOut(
        items=[AgentOut.from_orm(a) for a in items],
        total=total,
        page=page,
        size=size,
    )


@router.post(
    "/workspaces/{workspace_id}/agent-imports",
    response_model=AgentOut,
    status_code=status.HTTP_201_CREATED,
)
async def import_agent_yaml(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),  # noqa: B008
) -> AgentOut:
    """Import agent from Dify DSL YAML upload. O(s) where s = YAML size."""
    user, _ = caller
    raw = await file.read(_YAML_MAX_BYTES + 1)
    if len(raw) > _YAML_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="YAML file exceeds 1 MiB limit",
        )
    svc = AgentService(db, _runtime())
    agent = await svc.import_from_yaml(
        workspace_id=workspace_id,
        owner_id=user.id,
        raw_yaml=raw,
        filename=file.filename or "upload.yaml",
    )
    return AgentOut.from_orm(agent)


@router.post(
    "/workspaces/{workspace_id}/agent-imports/template",
    response_model=AgentOut,
    status_code=status.HTTP_201_CREATED,
)
async def import_agent_template(
    workspace_id: uuid.UUID,
    body: ImportFromTemplateIn,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AgentOut:
    """Create agent from a built-in template. O(1)."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    agent = await svc.import_from_template(
        workspace_id=workspace_id,
        owner_id=user.id,
        template_id=body.template_id,
        templates=_TEMPLATES,
    )
    return AgentOut.from_orm(agent)


@router.get("/workspaces/{workspace_id}/agents/{agent_id}", response_model=AgentOut)
async def get_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> AgentOut:
    """Get agent detail. O(1) primary key lookup."""
    return AgentOut.from_orm(agent)


@router.patch("/workspaces/{workspace_id}/agents/{agent_id}", response_model=AgentOut)
async def update_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: UpdateAgentIn,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> AgentOut:
    """Update draft agent. Creates a new version snapshot. O(1)."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    agent = await svc.update(
        agent=agent,
        actor_id=user.id,
        name=body.name,
        description=body.description,
        change_note=body.change_note,
    )
    return AgentOut.from_orm(agent)


@router.post(
    "/workspaces/{workspace_id}/agents/{agent_id}/publish",
    response_model=AgentOut,
)
async def publish_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
    background_tasks: BackgroundTasks,
) -> AgentOut:
    """Transition agent DRAFT → PUBLISHED. Indexes into Meilisearch as background task. O(1)."""
    from wekala.adapters.search.meilisearch import MeilisearchAdapter
    from wekala.services.bazaar_service import BazaarService

    user, _ = caller
    svc = AgentService(db, _runtime())
    search = MeilisearchAdapter(
        url=settings.meilisearch_url, master_key=settings.meilisearch_master_key
    )
    bazaar_svc = BazaarService(db, search)
    agent = await svc.publish(
        agent=agent,
        actor_id=user.id,
        bazaar_svc=bazaar_svc,
        background_tasks=background_tasks,
    )
    return AgentOut.from_orm(agent)


@router.post(
    "/workspaces/{workspace_id}/agents/{agent_id}/archive",
    response_model=AgentOut,
)
async def archive_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
    background_tasks: BackgroundTasks,
) -> AgentOut:
    """Transition agent → ARCHIVED. Removes from Meilisearch as background task. O(1)."""
    from wekala.adapters.search.meilisearch import MeilisearchAdapter
    from wekala.services.bazaar_service import BazaarService

    user, _ = caller
    svc = AgentService(db, _runtime())
    search = MeilisearchAdapter(
        url=settings.meilisearch_url, master_key=settings.meilisearch_master_key
    )
    bazaar_svc = BazaarService(db, search)
    agent = await svc.archive(
        agent=agent,
        actor_id=user.id,
        bazaar_svc=bazaar_svc,
        background_tasks=background_tasks,
    )
    return AgentOut.from_orm(agent)


@router.post(
    "/workspaces/{workspace_id}/agents/{agent_id}/clone",
    response_model=AgentOut,
    status_code=status.HTTP_201_CREATED,
)
async def clone_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> AgentOut:
    """Fork agent into new DRAFT in same workspace. O(1)."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    clone = await svc.clone(agent=agent, actor_id=user.id, workspace_id=workspace_id)
    return AgentOut.from_orm(clone)


@router.post(
    "/workspaces/{workspace_id}/agents/{agent_id}/transfer",
    response_model=AgentOut,
)
async def transfer_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: TransferAgentIn,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> AgentOut:
    """Transfer agent ownership. Admin only. O(1)."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    agent = await svc.transfer(agent=agent, actor_id=user.id, new_owner_id=body.new_owner_id)
    return AgentOut.from_orm(agent)


@router.get(
    "/workspaces/{workspace_id}/agents/{agent_id}/versions",
    response_model=list[AgentVersionOut],
)
async def list_versions(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
    page: int = 1,
    size: int = 20,
) -> list[AgentVersionOut]:
    """List version history newest-first. O(k) where k = versions per agent (<50)."""
    if size > 100:
        size = 100
    repo = AgentVersionRepository(db)
    versions = await repo.list(agent_id, page=page, size=size)
    return [AgentVersionOut.from_orm(v) for v in versions]


@router.post(
    "/workspaces/{workspace_id}/agents/{agent_id}/versions/{version_num}/rollback",
    response_model=AgentOut,
)
async def rollback_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    version_num: int,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> AgentOut:
    """Create new DRAFT from a version snapshot. Non-destructive. O(1)."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    agent = await svc.rollback(agent=agent, actor_id=user.id, version_num=version_num)
    return AgentOut.from_orm(agent)


@router.post(
    "/workspaces/{workspace_id}/agents/{agent_id}/test",
    response_model=dict,
)
async def test_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: TestAgentIn,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> dict:  # type: ignore[type-arg]
    """Sandbox non-streaming test. Quota: 100 invocations/day per user. O(log n) quota check."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    return await svc.test_sandbox(agent=agent, actor_id=user.id, query=body.query)


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    current_user: Annotated[UserResult, Depends(get_current_user)],
) -> list[TemplateOut]:
    """List built-in agent templates. O(t) where t = template count."""
    return [
        TemplateOut(id=t["id"], name=t["name"], description=t["description"])
        for t in _TEMPLATES.values()
    ]
