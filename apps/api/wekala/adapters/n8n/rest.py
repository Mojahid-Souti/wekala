"""HTTP client for n8n's internal REST API.

Complexity: each method is O(1) — a single HTTP call (login/invite/accept).
Owner bootstrap is amortized O(1) over the lifetime of the deployment.
"""

import re
import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import structlog

from wekala.adapters.n8n.base import (
    N8nService,
    N8nSession,
    N8nUser,
    OwnerAlreadyExistsError,
)

log = structlog.get_logger(__name__)

AUTH_COOKIE_NAME = "n8n-auth"
DEFAULT_TIMEOUT_S = 10.0


class N8nRestAdapter(N8nService):
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    # ------------------------------------------------------------------
    # Owner bootstrap (called once at API startup)
    # ------------------------------------------------------------------

    async def is_owner_setup(self) -> bool:
        """POST /rest/owner/setup with empty body returns 400 either way; check the message."""
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            try:
                r = await client.post(f"{self._base_url}/rest/owner/setup", json={})
            except httpx.RequestError:
                return False
            text = (r.text or "").lower()
            return "already" in text or "setup is already" in text

    async def setup_owner(
        self, email: str, password: str, first_name: str, last_name: str
    ) -> N8nUser:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            r = await client.post(
                f"{self._base_url}/rest/owner/setup",
                json={
                    "email": email,
                    "password": password,
                    "firstName": first_name,
                    "lastName": last_name,
                },
            )
            if r.status_code == 400 and "already" in (r.text or "").lower():
                raise OwnerAlreadyExistsError
            r.raise_for_status()
            body = r.json()
            data = body.get("data", body)
            return N8nUser(id=uuid.UUID(data["id"]), email=data["email"])

    # ------------------------------------------------------------------
    # Per-request: owner login + invite + accept + user login
    # ------------------------------------------------------------------

    async def login_as_owner(self, email: str, password: str) -> tuple[str, N8nUser]:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            r = await client.post(
                f"{self._base_url}/rest/login",
                json={"emailOrLdapLoginId": email, "password": password},
            )
            r.raise_for_status()
            cookie = r.cookies.get(AUTH_COOKIE_NAME)
            if not cookie:
                raise RuntimeError("n8n login returned no n8n-auth cookie")
            body = r.json()
            data = body.get("data", body)
            user = N8nUser(id=uuid.UUID(data["id"]), email=data["email"])
            return cookie, user

    async def invite_user(self, owner_cookie: str, email: str) -> tuple[uuid.UUID, str]:
        async with httpx.AsyncClient(
            timeout=DEFAULT_TIMEOUT_S, cookies={AUTH_COOKIE_NAME: owner_cookie}
        ) as client:
            r = await client.post(
                f"{self._base_url}/rest/invitations/",
                json=[{"email": email, "role": "global:member"}],
            )
            r.raise_for_status()
            body = r.json()
            users = body.get("data", body)
            if not users:
                raise RuntimeError(f"n8n invitation returned no users for {email}")
            entry = users[0].get("user", users[0])
            n8n_user_id = uuid.UUID(entry["id"])
            invite_url = entry.get("inviteAcceptUrl")
            if not invite_url:
                # Without an accept URL we still return the id; caller must
                # accept via the JWT bridge (out of scope here).
                raise RuntimeError(f"n8n did not return inviteAcceptUrl for {email}")
            parsed = urlparse(invite_url)
            token = parse_qs(parsed.query).get("token", [""])[0]
            return n8n_user_id, token

    async def accept_invitation(
        self,
        invite_token: str,
        first_name: str,
        last_name: str,
        password: str,
    ) -> None:
        # n8n's handler is acceptInvitationWithToken — it derives both
        # inviterId and inviteeId from the JWT in `token`. Pass that, NOT
        # the IDs.
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            r = await client.post(
                f"{self._base_url}/rest/invitations/accept",
                json={
                    "token": invite_token,
                    "firstName": first_name,
                    "lastName": last_name,
                    "password": password,
                },
            )
            r.raise_for_status()

    async def login_user(self, email: str, password: str) -> N8nSession:
        # n8n's /rest/login is rate-limited (~5/min) to defend against brute
        # force. React 19's StrictMode double-invokes effects in dev, so the
        # frontend often fires two /api/n8n-session POSTs in <100ms. Retry
        # once with a small delay if we hit the limit — this covers the
        # double-fire without weakening the protection.
        import asyncio

        for attempt in (1, 2):
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
                r = await client.post(
                    f"{self._base_url}/rest/login",
                    json={"emailOrLdapLoginId": email, "password": password},
                )
            if r.status_code == 429 and attempt == 1:
                await asyncio.sleep(1.5)
                continue
            r.raise_for_status()
            cookie = r.cookies.get(AUTH_COOKIE_NAME)
            if not cookie:
                raise RuntimeError("n8n login returned no n8n-auth cookie")
            max_age_s = 8 * 60 * 60
            body = r.json()
            data = body.get("data", body)
            n8n_user_id = uuid.UUID(data["id"])
            return N8nSession(
                cookie_name=AUTH_COOKIE_NAME,
                cookie_value=cookie,
                max_age_s=max_age_s,
                n8n_user_id=n8n_user_id,
            )
        raise RuntimeError("n8n login rate limit not cleared after retry")


# Safety: redact tokens from log messages where this adapter is invoked.
_redact_re = re.compile(r"(token|password|cookie)[^&\"]*", re.IGNORECASE)


def _redact(s: str) -> str:
    return _redact_re.sub("[REDACTED]", s)
