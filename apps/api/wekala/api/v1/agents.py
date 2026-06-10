"""Agent lifecycle endpoints.

All endpoints are workspace-scoped.
Auth enforced via require_workspace_role (same pattern as workspaces.py).
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated, Any

import httpx
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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.agent_runtime.dify import DifyAdapter
from wekala.adapters.auth.base import UserResult
from wekala.adapters.n8n.base import N8nService
from wekala.api.deps import get_current_user, get_n8n_service, require_workspace_role
from wekala.core.config import settings
from wekala.core.constants import Role
from wekala.db.models import Agent, AgentVersion
from wekala.db.repositories.agent import AgentRepository
from wekala.db.repositories.agent_version import AgentVersionRepository
from wekala.db.session import get_db
from wekala.services import n8n_provisioning
from wekala.services.agent_service import AgentService
from wekala.services.vetting_service import VettingService

router = APIRouter()
logger = logging.getLogger(__name__)

_YAML_MAX_BYTES = 1_048_576  # 1 MiB — also enforced in yaml_validator but checked here first


# ---------------------------------------------------------------------------
# Template loader (runs once at startup, cached in module scope)
# ---------------------------------------------------------------------------


def _load_templates() -> dict[str, dict[str, Any]]:
    """Load all YAML files from the templates/ directory. O(t) where t = template count."""
    templates: dict[str, dict[str, Any]] = {}
    templates_dir = Path(__file__).parent.parent.parent / "templates"
    if not templates_dir.is_dir():
        return templates
    for path in templates_dir.glob("*.yaml"):
        try:
            with path.open("rb") as f:
                dsl = yaml.safe_load(f)
            template_id = path.stem
            app = dsl.get("app", {}) or {}
            # `wekala_metadata` is a Wekala-side block — Dify ignores unknown
            # top-level keys, so it travels with the YAML without polluting it.
            meta = dsl.get("wekala_metadata", {}) or {}
            templates[template_id] = {
                "id": template_id,
                "name": app.get("name", template_id),
                "description": app.get("description", ""),
                "icon_emoji": app.get("icon", ""),
                "icon_background": app.get("icon_background", "#F5F5F5"),
                "icon_name": meta.get("icon_name", "Sparkles"),
                "category": meta.get("category", "Other"),
                "classification": meta.get("classification", "Internal"),
                "connectors": list(meta.get("connectors", [])),
                "tags": list(meta.get("tags", [])),
                "use_count": int(meta.get("use_count", 0)),
                "featured": bool(meta.get("featured", False)),
                "sample_prompts": list(dsl.get("suggested_questions", []) or []),
                "dsl": dsl,
            }
        except Exception:
            pass  # Skip malformed template files silently at startup
    return templates


_TEMPLATES: dict[str, dict[str, Any]] = _load_templates()


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
    kind: str
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
            kind=a.kind,
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


class ImportFromDifyIn(BaseModel):
    dify_app_id: str = Field(..., min_length=1, max_length=100)


class RegisterWorkflowIn(BaseModel):
    workflow_id: str = Field(..., min_length=1, max_length=100)


class WorkflowSourceOut(BaseModel):
    """One workflow available to publish as an agent (engine-neutral shape)."""

    id: str
    name: str
    active: bool
    updated_at: str | None


class RegisterWorkflowOut(BaseModel):
    agent: AgentOut
    vetting_run_id: uuid.UUID


class DifyAppOut(BaseModel):
    id: str
    name: str
    mode: str
    description: str


class TestAgentIn(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


class TemplateOut(BaseModel):
    id: str
    name: str
    description: str
    icon_emoji: str = ""
    icon_background: str = "#F5F5F5"
    icon_name: str = "Sparkles"
    category: str = "Other"
    classification: str = "Internal"
    connectors: list[str] = []
    tags: list[str] = []
    use_count: int = 0
    featured: bool = False
    sample_prompts: list[str] = []


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


@router.get("/workspaces/{workspace_id}/dify-apps", response_model=list[DifyAppOut])
async def list_dify_apps(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[DifyAppOut]:
    """List the connected Dify workspace's apps for the Build-in-Dify import picker.

    NOTE: Dify runs as a single shared workspace in the POC, so this lists every
    app in that workspace (not just the caller's). The import still lands the
    agent in this Wekala workspace. Per-workspace Dify projects are a prod concern.
    """
    svc = AgentService(db, _runtime())
    apps = await svc.list_dify_apps()
    return [DifyAppOut(**a) for a in apps]


@router.post(
    "/workspaces/{workspace_id}/agents/import-from-dify",
    response_model=AgentOut,
    status_code=status.HTTP_201_CREATED,
)
async def import_agent_from_dify(
    workspace_id: uuid.UUID,
    body: ImportFromDifyIn,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AgentOut:
    """Export a Dify app's DSL and import it as a Draft + Unvetted agent. O(s)."""
    user, _ = caller
    svc = AgentService(db, _runtime())
    agent = await svc.import_from_dify_app(
        workspace_id=workspace_id,
        owner_id=user.id,
        dify_app_id=body.dify_app_id,
    )
    return AgentOut.from_orm(agent)


@router.get(
    "/workspaces/{workspace_id}/agents/workflow-sources",
    response_model=list[WorkflowSourceOut],
)
async def list_workflow_sources(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    n8n: Annotated[N8nService, Depends(get_n8n_service)],
) -> list[WorkflowSourceOut]:
    """The caller's own studio workflows, for the publish-as-agent picker.

    Uses the caller's provisioned studio session — a user only ever sees
    their own workflows. O(1) network.
    """
    user, _ = caller
    session = await n8n_provisioning.ensure_session(
        db=db, n8n=n8n, supabase_user_id=user.id, wekala_full_name=None
    )
    try:
        workflows = await n8n.list_workflows(session.cookie_value)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Workflow engine unreachable"
        ) from exc
    return [
        WorkflowSourceOut(id=w.id, name=w.name, active=w.active, updated_at=w.updated_at)
        for w in workflows
    ]


@router.post(
    "/workspaces/{workspace_id}/agents/register-workflow",
    response_model=RegisterWorkflowOut,
    status_code=status.HTTP_201_CREATED,
)
async def register_workflow_agent(
    workspace_id: uuid.UUID,
    body: RegisterWorkflowIn,
    background_tasks: BackgroundTasks,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    n8n: Annotated[N8nService, Depends(get_n8n_service)],
) -> RegisterWorkflowOut:
    """Publish a studio workflow as a workflow agent.

    Fetches the workflow via the caller's OWN studio session (no cross-user
    access), registers it as Draft + Unvetted, and immediately submits it to
    the security-agent pipeline (Phase 6) — the publish modal polls the
    returned vetting run for progress. O(n) over workflow nodes.
    """
    user, _ = caller
    session = await n8n_provisioning.ensure_session(
        db=db, n8n=n8n, supabase_user_id=user.id, wekala_full_name=None
    )
    try:
        definition = await n8n.get_workflow(session.cookie_value, body.workflow_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Workflow engine unreachable"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Workflow engine unreachable"
        ) from exc

    svc = AgentService(db, _runtime())
    agent = await svc.register_workflow_agent(
        workspace_id=workspace_id,
        owner_id=user.id,
        workflow_id=body.workflow_id,
        definition=definition,
    )
    run = await VettingService(db).submit_for_review(
        agent=agent, actor_id=user.id, background_tasks=background_tasks
    )
    return RegisterWorkflowOut(agent=AgentOut.from_orm(agent), vetting_run_id=run.id)


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


class AgentYamlOut(BaseModel):
    yaml: str
    version: int


@router.get(
    "/workspaces/{workspace_id}/agents/{agent_id}/yaml",
    response_model=AgentYamlOut,
)
async def get_agent_yaml(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> AgentYamlOut:
    """Return the agent's current-version DSL serialized as YAML.

    Used by the vetting page to show the source-of-truth alongside findings.
    O(1) — single DB lookup + in-memory yaml.safe_dump.
    """
    repo = AgentVersionRepository(db)
    versions = await repo.list(agent_id, page=1, size=1)
    if not versions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent has no versions yet",
        )
    head = versions[0]
    yaml_text = yaml.safe_dump(head.dify_dsl, default_flow_style=False, sort_keys=False)
    return AgentYamlOut(yaml=yaml_text, version=head.version_num)


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


@router.post("/workspaces/{workspace_id}/agents/{agent_id}/test-stream")
async def test_agent_stream(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    body: TestAgentIn,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    agent: Annotated[Agent, Depends(_get_agent)],
) -> StreamingResponse:
    """Sandbox streaming test (SSE). Same 100/day quota as ``/test``.

    Relays Dify's token stream as ``data: {"token": "…"}`` frames and a terminal
    ``data: {"done": true, "usage": {…}}``. Quota (429), registration (503/409),
    and other pre-stream failures surface as normal JSON status codes because the
    generator is primed once before the response starts. O(log n) quota check.
    """
    user, _ = caller
    svc = AgentService(db, _runtime())
    agen = svc.stream_sandbox(agent=agent, actor_id=user.id, query=body.query)

    # Prime once: quota/registration checks run here, so their HTTPExceptions are
    # raised before the 200 + body start and become proper 429/503/409 responses.
    try:
        first: dict[str, Any] | None = await agen.__anext__()
    except StopAsyncIteration:
        first = None

    def _frame(item: dict[str, Any]) -> str:
        if "usage" in item:
            return f"data: {json.dumps({'done': True, 'usage': item['usage']})}\n\n"
        return f"data: {json.dumps(item)}\n\n"

    async def _sse() -> AsyncIterator[str]:
        done_sent = False
        try:
            if first is not None:
                yield _frame(first)
                done_sent = "usage" in first
            async for item in agen:
                yield _frame(item)
                done_sent = done_sent or ("usage" in item)
            if not done_sent:  # only emit a terminal frame if message_end didn't
                yield 'data: {"done": true}\n\n'
        except Exception:
            logger.exception("agent test-stream failed mid-stream")
            yield 'data: {"error": "stream_failed"}\n\n'
            yield 'data: {"done": true}\n\n'

    return StreamingResponse(
        _sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(
    current_user: Annotated[UserResult, Depends(get_current_user)],
) -> list[TemplateOut]:
    """List built-in agent templates with gallery metadata. O(t)."""
    return [
        TemplateOut(
            id=t["id"],
            name=t["name"],
            description=t["description"],
            icon_emoji=t["icon_emoji"],
            icon_background=t["icon_background"],
            icon_name=t["icon_name"],
            category=t["category"],
            classification=t["classification"],
            connectors=t["connectors"],
            tags=t["tags"],
            use_count=t["use_count"],
            featured=t["featured"],
            sample_prompts=t["sample_prompts"],
        )
        for t in _TEMPLATES.values()
    ]
