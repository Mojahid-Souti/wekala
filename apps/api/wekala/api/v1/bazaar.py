"""Bazaar endpoints — catalog, hire, and review.

Catalog endpoints (/v1/bazaar/*) are workspace-independent:
  any authenticated user in any workspace can browse published agents.
  The calling workspace_id is passed as a query param so the 'hired' flag
  is accurate for that workspace.

Hire endpoints (/v1/workspaces/{wid}/hires) are workspace-scoped.
Review endpoints (/v1/bazaar/agents/{aid}/reviews) use any valid workspace token.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.auth.base import UserResult
from wekala.adapters.search.meilisearch import MeilisearchAdapter
from wekala.api.deps import get_current_user, require_workspace_role
from wekala.core.config import settings
from wekala.core.constants import Role
from wekala.db.session import get_db
from wekala.services.bazaar_service import BazaarService

router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency — builds BazaarService with the Meilisearch adapter
# ---------------------------------------------------------------------------


def get_bazaar_service(db: Annotated[AsyncSession, Depends(get_db)]) -> BazaarService:
    search = MeilisearchAdapter(
        url=settings.meilisearch_url,
        master_key=settings.meilisearch_master_key,
    )
    return BazaarService(db, search)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ReviewIn(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    body: str = Field("", max_length=2000)


# ---------------------------------------------------------------------------
# Catalog — search and browse
# ---------------------------------------------------------------------------


@router.get("/bazaar/agents")
async def list_catalog(
    current_user: Annotated[UserResult, Depends(get_current_user)],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    q: str = Query("", description="Full-text search query"),  # noqa: B008
    category_ids: list[uuid.UUID] = Query(default=[], alias="cat"),  # noqa: B008
    workspace_id: uuid.UUID = Query(..., description="Calling workspace for hired-flag"),  # noqa: B008
    page: int = Query(1, ge=1),  # noqa: B008
    size: int = Query(20, ge=1, le=100),  # noqa: B008
) -> dict[str, object]:
    return await svc.search_catalog(
        q,
        category_ids=category_ids,
        page=page,
        size=size,
        calling_workspace_id=workspace_id,
    )


@router.get("/bazaar/agents/{agent_id}")
async def get_agent_detail(
    agent_id: uuid.UUID,
    current_user: Annotated[UserResult, Depends(get_current_user)],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    workspace_id: uuid.UUID = Query(..., description="Calling workspace for hired-flag"),  # noqa: B008
) -> dict[str, object]:
    return await svc.get_agent_detail(agent_id, calling_workspace_id=workspace_id)


@router.get("/bazaar/categories")
async def list_categories(
    current_user: Annotated[UserResult, Depends(get_current_user)],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
) -> list[dict[str, object]]:
    cats = await svc.list_categories()
    return [{"id": str(c.id), "name": c.name, "slug": c.slug} for c in cats]


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------


@router.post("/bazaar/agents/{agent_id}/reviews", status_code=201)
async def submit_review(
    agent_id: uuid.UUID,
    body: ReviewIn,
    current_user: Annotated[UserResult, Depends(get_current_user)],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    background_tasks: BackgroundTasks,
    workspace_id: uuid.UUID = Query(..., description="Reviewer's workspace"),  # noqa: B008
) -> dict[str, object]:
    review = await svc.submit_review(
        agent_id=agent_id,
        workspace_id=workspace_id,
        author_id=current_user.id,
        rating=body.rating,
        body=body.body,
        background_tasks=background_tasks,
    )
    return {
        "id": str(review.id),
        "agent_id": str(review.agent_id),
        "rating": review.rating,
        "body": review.body,
        "created_at": review.created_at.isoformat(),
    }


@router.get("/bazaar/agents/{agent_id}/reviews")
async def list_reviews(
    agent_id: uuid.UUID,
    current_user: Annotated[UserResult, Depends(get_current_user)],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    page: int = Query(1, ge=1),  # noqa: B008
    size: int = Query(20, ge=1, le=100),  # noqa: B008
) -> dict[str, object]:
    return await svc.list_reviews(agent_id, page=page, size=size)


# ---------------------------------------------------------------------------
# Hires — workspace-scoped
# ---------------------------------------------------------------------------


@router.post("/workspaces/{workspace_id}/hires", status_code=201)
async def hire_agent(
    workspace_id: uuid.UUID,
    agent_id: Annotated[uuid.UUID, Query()],  # noqa: B008
    auth: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.HIRER))],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    background_tasks: BackgroundTasks,
) -> dict[str, object]:
    current_user, _ = auth
    hire = await svc.hire(
        workspace_id=workspace_id,
        agent_id=agent_id,
        hired_by=current_user.id,
        background_tasks=background_tasks,
    )
    return {
        "id": str(hire.id),
        "workspace_id": str(hire.workspace_id),
        "agent_id": str(hire.agent_id),
        "hired_at": hire.hired_at.isoformat(),
    }


@router.get("/workspaces/{workspace_id}/hires")
async def list_hires(
    workspace_id: uuid.UUID,
    auth: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    page: int = Query(1, ge=1),  # noqa: B008
    size: int = Query(20, ge=1, le=100),  # noqa: B008
) -> dict[str, object]:
    return await svc.list_hires(workspace_id, page=page, size=size)


@router.delete("/workspaces/{workspace_id}/hires/{agent_id}", status_code=204)
async def unhire_agent(
    workspace_id: uuid.UUID,
    agent_id: uuid.UUID,
    auth: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.HIRER))],
    svc: Annotated[BazaarService, Depends(get_bazaar_service)],
    background_tasks: BackgroundTasks,
) -> None:
    current_user, _ = auth
    await svc.unhire(
        workspace_id=workspace_id,
        agent_id=agent_id,
        unhired_by=current_user.id,
        background_tasks=background_tasks,
    )
