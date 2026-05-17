"""Auth endpoint unit tests — all external calls mocked via dependency_overrides."""

import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from wekala.adapters.auth.base import SessionResult, UserResult
from wekala.api.deps import get_auth_service
from wekala.main import app

client = TestClient(app)

_MOCK_USER = UserResult(id=uuid.uuid4(), email="test@example.com", email_confirmed=True)
_MOCK_SESSION = SessionResult(
    access_token="test.jwt.token",
    refresh_token="test-refresh",
    token_type="bearer",
    expires_in=3600,
    user=_MOCK_USER,
)


def _mock_auth_service(
    sign_up_result: UserResult | Exception | None = None,
    sign_in_result: SessionResult | Exception | None = None,
):
    """Build an AsyncMock auth service for dependency override."""
    svc = AsyncMock()
    if isinstance(sign_up_result, Exception):
        svc.sign_up.side_effect = sign_up_result
    else:
        svc.sign_up.return_value = sign_up_result or _MOCK_USER

    if isinstance(sign_in_result, Exception):
        svc.sign_in.side_effect = sign_in_result
    else:
        svc.sign_in.return_value = sign_in_result or _MOCK_SESSION

    svc.reset_password.return_value = None
    return svc


@pytest.fixture(autouse=True)
def clear_overrides():
    """Ensure dependency overrides are cleared after every test."""
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------


def test_signup_success():
    app.dependency_overrides[get_auth_service] = lambda: _mock_auth_service()
    r = client.post(
        "/v1/auth/signup",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert r.status_code == 201
    assert r.json()["email"] == _MOCK_USER.email


def test_signup_password_too_short():
    r = client.post(
        "/v1/auth/signup",
        json={"email": "user@example.com", "password": "short"},
    )
    assert r.status_code == 422


def test_signup_invalid_email():
    r = client.post(
        "/v1/auth/signup",
        json={"email": "not-an-email", "password": "securepassword123"},
    )
    assert r.status_code == 422


def test_signup_upstream_failure_returns_400():
    app.dependency_overrides[get_auth_service] = lambda: _mock_auth_service(
        sign_up_result=RuntimeError("GoTrue error")
    )
    r = client.post(
        "/v1/auth/signup",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


def test_login_success():
    app.dependency_overrides[get_auth_service] = lambda: _mock_auth_service()
    r = client.post(
        "/v1/auth/login",
        json={"email": "user@example.com", "password": "securepassword123"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["access_token"] == _MOCK_SESSION.access_token
    assert data["user"]["email"] == _MOCK_USER.email


def test_login_wrong_credentials():
    app.dependency_overrides[get_auth_service] = lambda: _mock_auth_service(
        sign_in_result=RuntimeError("invalid credentials")
    )
    r = client.post(
        "/v1/auth/login",
        json={"email": "user@example.com", "password": "wrongpassword123"},
    )
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# Reset password — always 204, no user enumeration
# ---------------------------------------------------------------------------


def test_reset_password_always_succeeds():
    app.dependency_overrides[get_auth_service] = lambda: _mock_auth_service()
    r = client.post("/v1/auth/reset-password", json={"email": "anyone@example.com"})
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# /me — requires valid Bearer token
# ---------------------------------------------------------------------------


def test_me_unauthenticated():
    # HTTPBearer raises 401/403 when no Authorization header is present
    r = client.get("/v1/auth/me")
    assert r.status_code in (401, 403)
