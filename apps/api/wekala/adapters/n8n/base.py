"""Protocol + dataclasses for the n8n auth bridge.

Per CLAUDE.md Rule 5, business code depends on this Protocol; only the REST
adapter (rest.py) talks to n8n over HTTP. Swap adapters without touching
services/endpoints.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class N8nUser:
    """A user record inside n8n. id and email are stable; password is not stored here."""

    id: uuid.UUID
    email: str


@dataclass(frozen=True)
class N8nSession:
    """A live n8n session — cookie value the browser must send to be authenticated.

    `cookie_value` is the raw JWT the n8n login endpoint returned. `max_age_s`
    matches n8n's cookie maxAge; the frontend must set the cookie with the same
    Path (/n8n) so it scopes to the iframe proxy only.
    """

    cookie_name: str  # always "n8n-auth"
    cookie_value: str
    max_age_s: int
    n8n_user_id: uuid.UUID


@dataclass(frozen=True)
class N8nWorkflowInfo:
    """Lightweight view of one n8n workflow (backend-only; never branded in UI)."""

    id: str
    name: str
    active: bool
    updated_at: str | None


class OwnerAlreadyExistsError(Exception):
    """Raised when POST /rest/owner/setup is called but n8n already has an owner."""


class N8nService(Protocol):
    async def is_owner_setup(self) -> bool: ...

    async def setup_owner(
        self, email: str, password: str, first_name: str, last_name: str
    ) -> N8nUser: ...

    async def login_as_owner(self, email: str, password: str) -> tuple[str, N8nUser]:
        """Login as owner; return (n8n-auth cookie value, owner user record)."""
        ...

    async def invite_user(self, owner_cookie: str, email: str) -> tuple[uuid.UUID, str]:
        """Create a pending user shell; return (n8n user id, invite token)."""
        ...

    async def accept_invitation(
        self,
        invite_token: str,
        first_name: str,
        last_name: str,
        password: str,
    ) -> None: ...

    async def login_user(self, email: str, password: str) -> N8nSession: ...

    async def list_workflows(self, cookie: str) -> list[N8nWorkflowInfo]:
        """List workflows owned by the session behind `cookie`. Backend-only."""
        ...

    async def get_workflow(self, cookie: str, workflow_id: str) -> dict:  # type: ignore[type-arg]
        """Fetch one workflow's full JSON definition (nodes, connections)."""
        ...

    async def activate_workflow(self, cookie: str, workflow_id: str) -> None:
        """Activate a workflow so its production webhook endpoints are live."""
        ...
