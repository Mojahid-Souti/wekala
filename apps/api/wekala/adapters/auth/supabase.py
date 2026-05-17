import uuid

import httpx

from wekala.adapters.auth.base import AuthService, SessionResult, UserResult


def _parse_user(data: dict) -> UserResult:  # type: ignore[type-arg]
    return UserResult(
        id=uuid.UUID(data["id"]),
        email=data["email"],
        email_confirmed=bool(data.get("email_confirmed_at")),
    )


def _parse_session(data: dict) -> SessionResult:  # type: ignore[type-arg]
    return SessionResult(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        token_type=data.get("token_type", "bearer"),
        expires_in=data["expires_in"],
        user=_parse_user(data["user"]),
    )


class SupabaseAuthAdapter:
    """Calls GoTrue REST API. Swap for OmantelSSOAdapter or KeycloakAdapter in production."""

    def __init__(self, base_url: str, service_key: str) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/") + "/auth/v1",
            headers={"apikey": service_key, "Content-Type": "application/json"},
            timeout=10.0,
        )

    async def sign_up(self, email: str, password: str) -> UserResult:
        r = await self._client.post("/signup", json={"email": email, "password": password})
        r.raise_for_status()
        data = r.json()
        # GoTrue returns user directly when email confirmation required
        return _parse_user(data.get("user") or data)

    async def sign_in(self, email: str, password: str) -> SessionResult:
        r = await self._client.post(
            "/token?grant_type=password",
            json={"email": email, "password": password},
        )
        r.raise_for_status()
        return _parse_session(r.json())

    async def sign_out(self, access_token: str) -> None:
        await self._client.post(
            "/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    async def refresh_session(self, refresh_token: str) -> SessionResult:
        r = await self._client.post(
            "/token?grant_type=refresh_token",
            json={"refresh_token": refresh_token},
        )
        r.raise_for_status()
        return _parse_session(r.json())

    async def reset_password(self, email: str) -> None:
        await self._client.post("/recover", json={"email": email})

    async def get_user(self, access_token: str) -> UserResult:
        r = await self._client.get(
            "/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        return _parse_user(r.json())

    async def admin_delete_user(self, user_id: uuid.UUID) -> None:
        r = await self._client.delete(f"/admin/users/{user_id}")
        r.raise_for_status()

    async def revoke_all_sessions(self, user_id: uuid.UUID) -> None:
        r = await self._client.post(f"/admin/users/{user_id}/logout", json={"scope": "global"})
        r.raise_for_status()


# Ensure the adapter satisfies the protocol at import time
_: AuthService = SupabaseAuthAdapter.__new__(SupabaseAuthAdapter)  # type: ignore[type-abstract]
