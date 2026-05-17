"""DifyAdapter — calls Dify console API at http://dify-api:5001/console/api/*.

Token is read from settings at startup; never forwarded to the frontend.
All I/O is async via httpx.AsyncClient.
"""

import logging

import httpx

from wekala.core.config import settings

logger = logging.getLogger(__name__)

_ALLOWED_MODES = {"chat", "completion", "agent-chat", "workflow", "advanced-chat"}
_TIMEOUT = httpx.Timeout(30.0)


class DifyAdapter:
    """Concrete implementation of the AgentRuntime Protocol for Dify 1.14.x."""

    def __init__(self) -> None:
        self._base = settings.dify_base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {settings.dify_console_token}",
            "Content-Type": "application/json",
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(headers=self._headers, timeout=_TIMEOUT)

    async def register_app(self, name: str, dsl: dict) -> str:  # type: ignore[type-arg]
        """Create a new Dify app from DSL. Returns Dify app_id.

        Time: O(1) — single HTTP POST
        """
        async with self._client() as client:
            r = await client.post(
                f"{self._base}/console/api/apps/import",
                json={"data": dsl, "name": name},
            )
            r.raise_for_status()
            return str(r.json()["id"])

    async def update_app(self, app_id: str, dsl: dict) -> None:  # type: ignore[type-arg]
        """Push updated DSL to an existing Dify app. O(1) — single HTTP PUT."""
        async with self._client() as client:
            r = await client.put(
                f"{self._base}/console/api/apps/{app_id}/export",
                json={"data": dsl},
            )
            r.raise_for_status()

    async def invoke_sandbox(self, app_id: str, query: str, user_id: str) -> dict:  # type: ignore[type-arg]
        """Non-streaming sandbox chat. Returns {"answer": str, "usage": {...}}.

        Time: O(1) network — latency dominated by LLM inference.
        """
        async with self._client() as client:
            r = await client.post(
                f"{self._base}/v1/chat-messages",
                headers={**self._headers, "Authorization": f"Bearer {app_id}"},
                json={
                    "query": query,
                    "user": user_id,
                    "response_mode": "blocking",
                    "inputs": {},
                },
            )
            r.raise_for_status()
            data = r.json()
            return {"answer": data.get("answer", ""), "usage": data.get("metadata", {})}

    async def validate_dsl(self, dsl: dict) -> list[str]:  # type: ignore[type-arg]
        """Static validation of DSL dict. Returns error list; empty = valid. O(1)."""
        errors: list[str] = []
        app = dsl.get("app", {})
        name = app.get("name", "")
        if not isinstance(name, str) or not (2 <= len(name) <= 100):
            errors.append("app.name must be a string between 2 and 100 characters")
        mode = app.get("mode", "")
        if mode not in _ALLOWED_MODES:
            allowed = sorted(_ALLOWED_MODES)
            errors.append(f"app.mode '{mode}' is not allowed; must be one of {allowed}")
        return errors

    async def delete_app(self, app_id: str) -> None:
        """Delete a Dify app. O(1) — single HTTP DELETE."""
        async with self._client() as client:
            r = await client.delete(f"{self._base}/console/api/apps/{app_id}")
            if r.status_code not in (200, 204, 404):
                r.raise_for_status()
