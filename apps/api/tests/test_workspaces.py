"""Workspace endpoint unit tests — auth guard enforcement."""

import uuid

import pytest
from fastapi.testclient import TestClient

from wekala.main import app

client = TestClient(app)

# Workspace endpoints require a valid JWT — these tests verify auth guards only.
# Full RBAC integration tests live in scripts/test-phase-1.sh (make test-phase-1).


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def test_create_workspace_unauthenticated():
    r = client.post("/v1/workspaces", json={"name": "My Workspace"})
    assert r.status_code in (401, 403)


def test_list_workspaces_unauthenticated():
    r = client.get("/v1/workspaces")
    assert r.status_code in (401, 403)


def test_get_workspace_unauthenticated():
    r = client.get(f"/v1/workspaces/{uuid.uuid4()}")
    assert r.status_code in (401, 403)


def test_invite_member_unauthenticated():
    r = client.post(
        f"/v1/workspaces/{uuid.uuid4()}/members",
        json={"user_id": str(uuid.uuid4()), "role": "hirer"},
    )
    assert r.status_code in (401, 403)


def test_create_api_key_unauthenticated():
    r = client.post(
        f"/v1/workspaces/{uuid.uuid4()}/api-keys",
        json={"name": "my key"},
    )
    assert r.status_code in (401, 403)


def test_health():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
