import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.auth.base import UserResult
from wekala.api.deps import check_opa, get_current_user, require_workspace_role
from wekala.core.constants import Action, Role
from wekala.db.models import ApiKey, Membership, Workspace
from wekala.db.repositories.membership import MembershipRepository
from wekala.db.repositories.workspace import WorkspaceRepository
from wekala.db.session import get_db
from wekala.services.api_key_service import ApiKeyService
from wekala.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateWorkspaceRequest(BaseModel):
    name: str
    description: str = ""


class UpdateWorkspaceRequest(BaseModel):
    name: str
    description: str = ""


class InviteMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: Role


class UpdateRoleRequest(BaseModel):
    role: Role


class CreateApiKeyRequest(BaseModel):
    name: str


class WorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str
    owner_id: uuid.UUID

    @classmethod
    def from_model(cls, ws: Workspace) -> "WorkspaceOut":
        return cls(
            id=ws.id,
            name=ws.name,
            slug=ws.slug,
            description=ws.description,
            owner_id=ws.owner_id,
        )


class MemberOut(BaseModel):
    user_id: uuid.UUID
    role: str
    invited_by: uuid.UUID | None

    @classmethod
    def from_model(cls, m: Membership) -> "MemberOut":
        return cls(user_id=m.user_id, role=m.role, invited_by=m.invited_by)


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    scopes: list[str]

    @classmethod
    def from_model(cls, k: ApiKey) -> "ApiKeyOut":
        return cls(id=k.id, name=k.name, key_prefix=k.key_prefix, scopes=k.scopes)


class ApiKeyCreatedOut(ApiKeyOut):
    """Returned once on creation — includes the full plaintext key."""

    key: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: CreateWorkspaceRequest,
    current_user: Annotated[UserResult, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    svc = WorkspaceService(db)
    ws = await svc.create(name=body.name, owner_id=current_user.id, description=body.description)
    return WorkspaceOut.from_model(ws)


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    current_user: Annotated[UserResult, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WorkspaceOut]:
    repo = WorkspaceRepository(db)
    workspaces = await repo.list_for_user(current_user.id)
    return [WorkspaceOut.from_model(ws) for ws in workspaces]


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    repo = WorkspaceRepository(db)
    ws = await repo.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return WorkspaceOut.from_model(ws)


@router.put("/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(
    workspace_id: uuid.UUID,
    body: UpdateWorkspaceRequest,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WorkspaceOut:
    current_user, _ = caller
    svc = WorkspaceService(db)
    ws = await svc.update(workspace_id, current_user.id, body.name, body.description)
    return WorkspaceOut.from_model(ws)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    current_user, _ = caller
    svc = WorkspaceService(db)
    await svc.delete(workspace_id, current_user.id)


@router.post("/{workspace_id}/members", response_model=MemberOut, status_code=201)
async def invite_member(
    workspace_id: uuid.UUID,
    body: InviteMemberRequest,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MemberOut:
    current_user, caller_role = caller
    allowed = await check_opa(Action.WORKSPACE_INVITE, caller_role)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    svc = WorkspaceService(db)
    m = await svc.invite(
        workspace_id=workspace_id,
        inviter_id=current_user.id,
        invitee_id=body.user_id,
        role=body.role,
    )
    return MemberOut.from_model(m)


@router.get("/{workspace_id}/members", response_model=list[MemberOut])
async def list_members(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MemberOut]:
    repo = MembershipRepository(db)
    members = await repo.list_for_workspace(workspace_id)
    return [MemberOut.from_model(m) for m in members]


@router.put("/{workspace_id}/members/{user_id}", response_model=MemberOut)
async def update_member_role(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateRoleRequest,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MemberOut:
    current_user, _ = caller
    svc = WorkspaceService(db)
    m = await svc.update_role(workspace_id, current_user.id, user_id, body.role)
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return MemberOut.from_model(m)


@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    current_user, _ = caller
    svc = WorkspaceService(db)
    await svc.remove_member(workspace_id, current_user.id, user_id)


@router.post("/{workspace_id}/api-keys", response_model=ApiKeyCreatedOut, status_code=201)
async def create_api_key(
    workspace_id: uuid.UUID,
    body: CreateApiKeyRequest,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiKeyCreatedOut:
    current_user, _ = caller
    svc = ApiKeyService(db)
    record, plaintext = await svc.generate(workspace_id, body.name, current_user.id)
    return ApiKeyCreatedOut(
        id=record.id,
        name=record.name,
        key_prefix=record.key_prefix,
        scopes=record.scopes,
        key=plaintext,
    )


@router.get("/{workspace_id}/api-keys", response_model=list[ApiKeyOut])
async def list_api_keys(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ApiKeyOut]:
    from sqlalchemy import select

    from wekala.db.models import ApiKey as ApiKeyModel

    result = await db.execute(
        select(ApiKeyModel)
        .where(ApiKeyModel.workspace_id == workspace_id, ApiKeyModel.revoked_at.is_(None))
        .order_by(ApiKeyModel.created_at.desc())
    )
    keys = list(result.scalars().all())
    return [ApiKeyOut.from_model(k) for k in keys]


@router.delete("/{workspace_id}/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    workspace_id: uuid.UUID,
    key_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    current_user, _ = caller
    svc = ApiKeyService(db)
    result = await svc.revoke(key_id, current_user.id, workspace_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
