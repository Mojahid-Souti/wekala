"""Phase 14 — agent streaming + lazy Dify registration unit tests.

Covers the DifyAdapter SSE relay parsing and AgentService._ensure_registered /
stream_sandbox guard logic. Fully mocked — no real Dify or DB.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi import HTTPException

from wekala.adapters.agent_runtime.dify import DifyAdapter
from wekala.core.config import settings
from wekala.services.agent_service import AgentService


def _mock_adapter(body: str) -> DifyAdapter:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=body.encode(), headers={"content-type": "text/event-stream"}
        )

    adapter = DifyAdapter()
    adapter._client = lambda: httpx.AsyncClient(  # type: ignore[method-assign]
        transport=httpx.MockTransport(handler), timeout=httpx.Timeout(5.0)
    )
    return adapter


# --- DifyAdapter.stream_sandbox: SSE parsing --------------------------------


async def test_stream_sandbox_parses_dify_sse() -> None:
    body = (
        'data: {"event": "message", "answer": "Hello"}\n\n'
        'data: {"event": "message", "answer": " world"}\n\n'
        "data: ping\n\n"  # non-JSON keepalive — must be skipped
        'data: {"event": "message_end", "metadata": {"usage": {"total_tokens": 5}}}\n\n'
    )
    items = [item async for item in _mock_adapter(body).stream_sandbox("app", "hi", "u")]

    assert {"token": "Hello"} in items
    assert {"token": " world"} in items
    assert items[-1] == {"usage": {"usage": {"total_tokens": 5}}}


async def test_stream_sandbox_raises_on_error_event() -> None:
    body = 'data: {"event": "error", "message": "boom"}\n\n'
    with pytest.raises(RuntimeError):
        [item async for item in _mock_adapter(body).stream_sandbox("app", "hi", "u")]


# --- AgentService._ensure_registered ----------------------------------------


def _svc() -> AgentService:
    return AgentService(db=MagicMock(), runtime=AsyncMock())


def _agent(**overrides: object) -> SimpleNamespace:
    base: dict[str, object] = {
        "id": uuid.uuid4(),
        "workspace_id": uuid.uuid4(),
        "name": "Agent A",
        "dify_dsl": {"app": {"name": "Agent A", "mode": "chat"}},
        "dify_app_id": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


async def test_ensure_registered_returns_existing_without_calling_runtime() -> None:
    svc = _svc()
    result = await svc._ensure_registered(_agent(dify_app_id="existing-id"))
    assert result == "existing-id"
    svc._runtime.register_app.assert_not_called()


async def test_ensure_registered_503_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dify_console_token", "")
    with pytest.raises(HTTPException) as exc:
        await _svc()._ensure_registered(_agent())
    assert exc.value.status_code == 503


async def test_ensure_registered_409_when_no_dsl(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dify_console_token", "tok")
    with pytest.raises(HTTPException) as exc:
        await _svc()._ensure_registered(_agent(dify_dsl={}))
    assert exc.value.status_code == 409


async def test_ensure_registered_registers_and_persists(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dify_console_token", "tok")
    svc = _svc()
    svc._runtime.register_app = AsyncMock(return_value="new-app-id")
    nested = MagicMock()
    nested.__aenter__ = AsyncMock(return_value=None)
    nested.__aexit__ = AsyncMock(return_value=False)
    svc._db.begin_nested = MagicMock(return_value=nested)
    svc._agents.update = AsyncMock()

    result = await svc._ensure_registered(_agent())

    assert result == "new-app-id"
    svc._runtime.register_app.assert_awaited_once()
    svc._agents.update.assert_awaited_once()


async def test_ensure_registered_503_on_dify_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "dify_console_token", "tok")
    svc = _svc()
    svc._runtime.register_app = AsyncMock(side_effect=httpx.ConnectError("down"))
    with pytest.raises(HTTPException) as exc:
        await svc._ensure_registered(_agent())
    assert exc.value.status_code == 503


# --- AgentService.stream_sandbox: quota -------------------------------------


async def test_stream_sandbox_enforces_quota() -> None:
    svc = _svc()
    svc._agents.count_sandbox_uses_today = AsyncMock(
        return_value=settings.agent_sandbox_daily_quota
    )
    agen = svc.stream_sandbox(agent=_agent(), actor_id=uuid.uuid4(), query="hi")
    with pytest.raises(HTTPException) as exc:
        await agen.__anext__()
    assert exc.value.status_code == 429
