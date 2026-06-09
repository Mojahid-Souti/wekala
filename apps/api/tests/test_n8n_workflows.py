"""Phase 15 — Surface 2: n8n workflow listing.

Covers the adapter's parse of n8n's /rest/workflows, the endpoint auth guard,
and the endpoint's mapping to WorkflowOut.
"""

import asyncio
import uuid
from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastapi.testclient import TestClient

from wekala.adapters.n8n.base import N8nSession, N8nWorkflowInfo
from wekala.adapters.n8n.rest import N8nRestAdapter
from wekala.api.deps import get_current_user, get_n8n_service
from wekala.db.session import get_db
from wekala.main import app
from wekala.services import n8n_provisioning

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_overrides() -> Generator[None]:
    yield
    app.dependency_overrides.clear()


def test_list_workflows_unauthenticated() -> None:
    assert client.get("/v1/n8n/workflows").status_code in (401, 403)


def test_adapter_parses_workflows(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(_req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": 7, "name": "Morning digest", "active": True, "updatedAt": "2026-06-01"},
                    {"id": "8", "name": "No date", "active": False},
                ]
            },
        )

    real = httpx.AsyncClient

    def fake_client(*_a: object, **kw: object) -> httpx.AsyncClient:
        kw.pop("cookies", None)
        return real(transport=httpx.MockTransport(handler), timeout=httpx.Timeout(5.0))

    monkeypatch.setattr("wekala.adapters.n8n.rest.httpx.AsyncClient", fake_client)
    wfs = asyncio.run(N8nRestAdapter(base_url="http://n8n").list_workflows("cookie"))
    assert [w.id for w in wfs] == ["7", "8"]
    assert wfs[0].name == "Morning digest"
    assert wfs[0].active is True
    assert wfs[1].updated_at is None


def test_endpoint_maps_workflows(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_n8n = MagicMock()
    fake_n8n.list_workflows = AsyncMock(
        return_value=[N8nWorkflowInfo(id="1", name="wf", active=True, updated_at="2026-06-01")]
    )
    monkeypatch.setattr(
        n8n_provisioning,
        "ensure_session",
        AsyncMock(
            return_value=N8nSession(
                cookie_name="n8n-auth", cookie_value="c", max_age_s=3600, n8n_user_id=uuid.uuid4()
            )
        ),
    )
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id=uuid.uuid4())
    app.dependency_overrides[get_n8n_service] = lambda: fake_n8n
    app.dependency_overrides[get_db] = lambda: None

    r = client.get("/v1/n8n/workflows")
    assert r.status_code == 200
    assert r.json() == [{"id": "1", "name": "wf", "active": True, "updated_at": "2026-06-01"}]
