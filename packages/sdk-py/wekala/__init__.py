"""Wekala Python SDK — minimal client for the public API.

Usage:

    from wekala import WekalaClient

    client = WekalaClient(api_key="wk_...", base_url="https://api.wekala.example")
    result = client.invoke_agent("agent-uuid", query="What time is it?")
    print(result["answer"])

Webhook signature verification:

    from wekala import verify_webhook_signature

    if not verify_webhook_signature(secret, request_body_bytes, signature_header):
        return 401

This SDK targets Python 3.11+. It uses `httpx` (async-capable but the public
surface here is sync to keep the quickstart short). For streaming use the
`stream_agent` async method.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import httpx

__version__ = "0.1.0"
__all__ = [
    "InvokeResult",
    "RateLimitError",
    "WekalaClient",
    "WekalaError",
    "verify_webhook_signature",
]


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class WekalaError(Exception):
    """Base class for SDK errors."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class RateLimitError(WekalaError):
    """Returned when the API responds with 429. Inspect `retry_after_seconds`."""

    def __init__(self, message: str, retry_after_seconds: int = 0) -> None:
        super().__init__(message, status_code=429)
        self.retry_after_seconds = retry_after_seconds


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class InvokeResult:
    agent_id: str
    answer: str
    usage: dict[str, Any]
    latency_ms: int


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class WekalaClient:
    """Thin wrapper around the Wekala public API."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = "http://localhost:8001",
        timeout: float = 30.0,
    ) -> None:
        if not api_key or not api_key.startswith("wk_"):
            raise ValueError("api_key must start with 'wk_'")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"wekala-python/{__version__}",
        }

    def invoke_agent(self, agent_id: str, query: str) -> InvokeResult:
        """Synchronously invoke a published+approved agent. Raises on non-2xx."""
        with httpx.Client(timeout=self._timeout) as client:
            r = client.post(
                f"{self._base_url}/v1/agents/{agent_id}/invoke",
                json={"query": query},
                headers=self._headers,
            )
        self._raise_for_status(r)
        data = r.json()
        return InvokeResult(
            agent_id=data["agent_id"],
            answer=data["answer"],
            usage=data.get("usage", {}),
            latency_ms=int(data.get("latency_ms", 0)),
        )

    async def stream_agent(
        self, agent_id: str, query: str
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream events from the agent (SSE). Yields parsed event dicts."""
        url = f"{self._base_url}/v1/agents/{agent_id}/stream"
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", url, json={"query": query}, headers=self._headers
            ) as resp:
                self._raise_for_status(resp)
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    try:
                        yield json.loads(line.removeprefix("data:").strip())
                    except json.JSONDecodeError:
                        continue

    @staticmethod
    def _raise_for_status(r: httpx.Response) -> None:
        if 200 <= r.status_code < 300:
            return
        try:
            detail = r.json().get("detail", r.text)
        except Exception:  # noqa: BLE001
            detail = r.text
        if r.status_code == 429:
            try:
                retry = int(r.headers.get("Retry-After", "60"))
            except ValueError:
                retry = 60
            raise RateLimitError(str(detail), retry_after_seconds=retry)
        raise WekalaError(str(detail), status_code=r.status_code)


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------


def verify_webhook_signature(secret: str, body: bytes, signature_header: str) -> bool:
    """Constant-time check of `X-Wekala-Signature: sha256=<hex>`.

    Use this in your webhook receiver:

        if not verify_webhook_signature(YOUR_SECRET, await req.body(), req.headers["X-Wekala-Signature"]):
            return Response(status_code=401)
    """
    if not signature_header:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    expected = f"sha256={digest}"
    return hmac.compare_digest(expected, signature_header)
