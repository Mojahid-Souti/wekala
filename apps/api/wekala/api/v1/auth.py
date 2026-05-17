import contextlib
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator

from wekala.adapters.auth.base import AuthService, SessionResult, UserResult
from wekala.api.deps import get_auth_service, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    id: str
    email: str
    email_confirmed: bool


class SessionOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: UserOut


def _user_out(u: UserResult) -> UserOut:
    return UserOut(id=str(u.id), email=u.email, email_confirmed=u.email_confirmed)


def _session_out(s: SessionResult) -> SessionOut:
    return SessionOut(
        access_token=s.access_token,
        refresh_token=s.refresh_token,
        token_type=s.token_type,
        expires_in=s.expires_in,
        user=_user_out(s.user),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(
    body: SignUpRequest,
    background: BackgroundTasks,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> UserOut:
    try:
        user = await auth.sign_up(body.email, body.password)
    except Exception as exc:
        # Return identical error shape regardless of reason (no user enumeration)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup failed. Check your email and password.",
        ) from exc
    return _user_out(user)


@router.post("/login", response_model=SessionOut)
async def login(
    body: LoginRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> SessionOut:
    try:
        session = await auth.sign_in(body.email, body.password)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        ) from exc
    return _session_out(session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: Annotated[UserResult, Depends(get_current_user)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    # We don't have the raw token here, but GoTrue also expires on JWT exp
    # Full revocation happens via GoTrue's admin endpoint if needed
    pass


@router.post("/refresh", response_model=SessionOut)
async def refresh(
    body: RefreshRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> SessionOut:
    try:
        session = await auth.refresh_session(body.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc
    return _session_out(session)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    body: ResetPasswordRequest,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> None:
    # Always succeed — don't reveal whether the email exists
    with contextlib.suppress(Exception):
        await auth.reset_password(body.email)


@router.get("/me", response_model=UserOut)
async def me(
    current_user: Annotated[UserResult, Depends(get_current_user)],
) -> UserOut:
    return _user_out(current_user)
