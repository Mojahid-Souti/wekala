import uuid
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.auth.base import AuthService, UserResult
from wekala.adapters.auth.supabase import SupabaseAuthAdapter
from wekala.core.config import settings
from wekala.core.constants import Action, Role
from wekala.db.repositories.membership import MembershipRepository
from wekala.db.session import get_db

_bearer = HTTPBearer()


def get_auth_service() -> AuthService:
    return SupabaseAuthAdapter(
        base_url=str(settings.wekala_supabase_url),
        service_key=settings.wekala_supabase_service_key,
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> UserResult:
    """Verify Supabase JWT locally (no network round-trip). O(1)."""
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
    except JWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from err

    user_id = payload.get("sub")
    email = payload.get("email", "")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return UserResult(
        id=uuid.UUID(user_id),
        email=email,
        email_confirmed=bool(payload.get("email_confirmed_at")),
    )


async def check_opa(action: Action, role: Role) -> bool:
    """Call OPA sidecar for authorization decision. Result is per-request (not cached globally)."""
    async with httpx.AsyncClient(timeout=2.0) as client:
        try:
            r = await client.post(
                f"{settings.opa_url}/v1/data/wekala/authz/allow",
                json={"input": {"action": action, "role": role}},
            )
            return bool(r.json().get("result", False))
        except Exception:
            return False


def require_workspace_role(min_role: Role):  # type: ignore[no-untyped-def]
    """Dependency factory: resolves caller's membership and enforces min role via OPA."""

    async def _dep(
        workspace_id: uuid.UUID,
        current_user: Annotated[UserResult, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> tuple[UserResult, Role]:
        repo = MembershipRepository(db)
        membership = await repo.get(workspace_id, current_user.id)
        if not membership:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

        caller_role = Role(membership.role)
        # OPA enforces the minimum role for WORKSPACE_VIEW as a baseline
        allowed = await check_opa(Action.WORKSPACE_VIEW, caller_role)
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        from wekala.core.constants import ROLE_RANK

        if ROLE_RANK[caller_role] < ROLE_RANK[min_role]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

        return current_user, caller_role

    return _dep
