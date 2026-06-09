"""Wekala→n8n session bridge endpoint.

POST /v1/n8n/session — caller's Supabase JWT in the Authorization header.
Returns the cookie name + value the frontend must set on the response so the
embedded iframe loads with the user's private n8n session.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.auth.base import UserResult
from wekala.adapters.n8n.base import N8nService
from wekala.api.deps import get_current_user, get_n8n_service
from wekala.db.session import get_db
from wekala.services import n8n_provisioning

router = APIRouter(prefix="/n8n", tags=["n8n"])


class N8nSessionResponse(BaseModel):
    cookie_name: str
    cookie_value: str
    max_age_s: int
    cookie_path: str = "/n8n"


class WorkflowOut(BaseModel):
    id: str
    name: str
    active: bool
    updated_at: str | None = None


@router.post("/session", response_model=N8nSessionResponse)
async def create_n8n_session(
    current_user: Annotated[UserResult, Depends(get_current_user)],
    n8n: Annotated[N8nService, Depends(get_n8n_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> N8nSessionResponse:
    """Mint a fresh n8n session cookie for the current Wekala user.

    The caller is expected to be the Next.js build-page server, which sets
    the returned cookie on its response to the browser before serving the
    iframe shell. The cookie is HttpOnly + scoped to /n8n so it's only sent
    to the n8n proxy path.
    """
    session = await n8n_provisioning.ensure_session(
        db=db,
        n8n=n8n,
        supabase_user_id=current_user.id,
        wekala_full_name=None,  # TODO: thread Supabase user_metadata.full_name in
    )
    return N8nSessionResponse(
        cookie_name=session.cookie_name,
        cookie_value=session.cookie_value,
        max_age_s=session.max_age_s,
    )


@router.get("/workflows", response_model=list[WorkflowOut])
async def list_n8n_workflows(
    current_user: Annotated[UserResult, Depends(get_current_user)],
    n8n: Annotated[N8nService, Depends(get_n8n_service)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkflowOut]:
    """List the current user's own n8n workflows, surfaced inside Wekala's UI.

    Uses the caller's provisioned n8n session, so a user only ever sees their
    own workflows (per-user n8n accounts, Phase B). O(1) — one login + one GET.
    """
    session = await n8n_provisioning.ensure_session(
        db=db,
        n8n=n8n,
        supabase_user_id=current_user.id,
        wekala_full_name=None,
    )
    workflows = await n8n.list_workflows(session.cookie_value)
    return [
        WorkflowOut(id=w.id, name=w.name, active=w.active, updated_at=w.updated_at)
        for w in workflows
    ]
