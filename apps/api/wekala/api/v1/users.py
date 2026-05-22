"""
User utility endpoints — lightweight lookups to support workspace invite-by-email flow.
No user data is stored here; reads are proxied to Supabase GoTrue admin API.
"""

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from wekala.adapters.auth.base import UserResult
from wekala.api.deps import get_current_user
from wekala.core.config import settings

router = APIRouter(prefix="/users", tags=["users"])


class UserLookupOut(BaseModel):
    id: str
    email: str


@router.get("/lookup", response_model=UserLookupOut)
async def lookup_user_by_email(
    email: str = Query(..., description="Email address to look up"),
    _current_user: Annotated[UserResult, Depends(get_current_user)] = None,
) -> UserLookupOut:
    """
    Look up a platform user by email address.
    Used by the workspace invite-by-email flow.
    Requires a valid session token (any role).
    O(1) — single Supabase admin API call.
    """
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(
            f"{settings.wekala_supabase_url}/auth/v1/admin/users",
            headers={
                "apikey": settings.wekala_supabase_service_key,
                "Authorization": f"Bearer {settings.wekala_supabase_service_key}",
            },
            params={"email": email},
        )

    if r.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth service error"
        )

    data = r.json()
    users = data.get("users", [])
    if not users:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = users[0]
    return UserLookupOut(id=user["id"], email=user["email"])
