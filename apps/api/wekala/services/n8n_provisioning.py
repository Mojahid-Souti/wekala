"""Provision per-Wekala-user n8n accounts on first canvas access.

Owner bootstrap runs once at API startup (idempotent — checks via
is_owner_setup). Per-user provisioning is lazy: the first call to
ensure_session for a Wekala user creates the n8n shell + invitation + accepts
it + logs them in.

Encryption: per-user n8n passwords are Fernet-encrypted at rest with
WEKALA_FIELD_ENCRYPTION_KEY. Rotating the key invalidates all stored
mappings (users get re-provisioned on next canvas access).
"""

import asyncio
import secrets
import string
import uuid

import httpx
import structlog
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.n8n.base import (
    N8nService,
    N8nSession,
    OwnerAlreadyExistsError,
)
from wekala.adapters.n8n.rest import N8nRestAdapter
from wekala.core.config import settings
from wekala.db.models import N8nUserLink

log = structlog.get_logger(__name__)

_PASSWORD_ALPHABET = string.ascii_letters + string.digits
_PASSWORD_LENGTH = 28
# n8n requires: 8+ chars, at least one uppercase, one digit, one special char.
_PASSWORD_SPECIAL = "@$!%*?&"


def _generate_n8n_password() -> str:
    """Generate a password that satisfies n8n's strength rules deterministically."""
    body = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(_PASSWORD_LENGTH - 4))
    # Guarantee at least one uppercase, one digit, one special — append them.
    upper = secrets.choice(string.ascii_uppercase)
    digit = secrets.choice(string.digits)
    special = secrets.choice(_PASSWORD_SPECIAL)
    # And one lowercase for good measure.
    lower = secrets.choice(string.ascii_lowercase)
    return body + upper + digit + special + lower


def _fernet() -> Fernet:
    key = settings.wekala_field_encryption_key
    if not key:
        raise RuntimeError(
            "WEKALA_FIELD_ENCRYPTION_KEY is unset — required for n8n password storage"
        )
    return Fernet(key.encode())


def _encrypt(plaintext: str) -> bytes:
    return _fernet().encrypt(plaintext.encode())


def _decrypt(ciphertext: bytes) -> str:
    try:
        return _fernet().decrypt(ciphertext).decode()
    except InvalidToken as err:
        raise RuntimeError("n8n password decryption failed (encryption key rotated?)") from err


def _derive_n8n_email(supabase_user_id: uuid.UUID) -> str:
    """Map a Supabase UUID to a stable, internal n8n email.

    We don't reuse the Wekala user's real email because the n8n side never
    sends mail (no SMTP configured) and we want the n8n username space to be
    fully owned by Wekala. Using a UUID-based local part keeps mappings
    unambiguous if a teammate ever changes their real email.
    """
    return f"u-{supabase_user_id.hex}@wekala.local"


# ----------------------------------------------------------------------
# Owner bootstrap (called once on API startup; idempotent)
# ----------------------------------------------------------------------


async def bootstrap_owner_with_retry(
    n8n: N8nService,
    retries: int = 30,
    initial_backoff_s: float = 2.0,
) -> None:
    """Wait for n8n to be ready, then set up the owner if not yet present.

    Safe to call on every API boot. If owner exists, returns silently.
    Logs and exits early if the owner password is unconfigured (so we don't
    silently leave n8n in an unauthenticated state).
    """
    if not (settings.wekala_n8n_owner_email and settings.wekala_n8n_owner_password):
        log.error("n8n_owner_bootstrap_skipped_missing_credentials")
        return

    backoff = initial_backoff_s
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            already = await n8n.is_owner_setup()
        except httpx.RequestError as err:
            last_err = err
            log.debug("n8n_owner_bootstrap_waiting", attempt=attempt, error=str(err))
            await asyncio.sleep(backoff)
            backoff = min(backoff * 1.5, 30)
            continue

        if already:
            log.info("n8n_owner_already_setup")
            return

        try:
            owner = await n8n.setup_owner(
                email=settings.wekala_n8n_owner_email,
                password=settings.wekala_n8n_owner_password,
                first_name=settings.wekala_n8n_owner_first_name,
                last_name=settings.wekala_n8n_owner_last_name,
            )
        except OwnerAlreadyExistsError:
            log.info("n8n_owner_already_setup_race")
            return
        except Exception as err:  # noqa: BLE001 — log full details, then crash boot
            log.exception("n8n_owner_setup_failed", error=str(err))
            raise

        log.info("n8n_owner_setup_complete", owner_id=str(owner.id))
        return

    log.error("n8n_owner_bootstrap_gave_up", retries=retries, last_error=str(last_err))


# ----------------------------------------------------------------------
# Per-user lazy provisioning
# ----------------------------------------------------------------------


async def ensure_session(
    db: AsyncSession,
    n8n: N8nService,
    supabase_user_id: uuid.UUID,
    wekala_full_name: str | None,
) -> N8nSession:
    """Return a logged-in n8n session for this Wekala user; provision if needed.

    Complexity: O(1) — one DB read, optionally one DB write + 3 HTTP calls on
    first access; one DB read + one HTTP call on subsequent accesses.
    """
    link = await _get_link(db, supabase_user_id)
    if link is None:
        link = await _provision(db, n8n, supabase_user_id, wekala_full_name)

    password = _decrypt(link.n8n_password_encrypted)
    session = await n8n.login_user(email=link.n8n_email, password=password)
    return session


async def _get_link(db: AsyncSession, supabase_user_id: uuid.UUID) -> N8nUserLink | None:
    stmt = select(N8nUserLink).where(N8nUserLink.supabase_user_id == supabase_user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _provision(
    db: AsyncSession,
    n8n: N8nService,
    supabase_user_id: uuid.UUID,
    wekala_full_name: str | None,
) -> N8nUserLink:
    n8n_email = _derive_n8n_email(supabase_user_id)
    password = _generate_n8n_password()

    # 1. Log in as owner (cookie is needed to call /rest/invitations/).
    owner_cookie, _owner = await n8n.login_as_owner(
        email=settings.wekala_n8n_owner_email,
        password=settings.wekala_n8n_owner_password,
    )

    # 2. Create (or re-invite) user shell + capture the JWT invite token.
    invitee_id, invite_token = await n8n.invite_user(owner_cookie, n8n_email)

    # 3. Accept the invitation — n8n derives inviter+invitee from the token.
    first_name, last_name = _split_name(wekala_full_name)
    await n8n.accept_invitation(
        invite_token=invite_token,
        first_name=first_name,
        last_name=last_name,
        password=password,
    )

    # 4. Persist the mapping (encrypted password).
    link = N8nUserLink(
        supabase_user_id=supabase_user_id,
        n8n_user_id=invitee_id,
        n8n_email=n8n_email,
        n8n_password_encrypted=_encrypt(password),
    )
    db.add(link)
    await db.commit()
    # No refresh() — the session's transaction closes after commit() in our
    # request-scoped session, and we don't need server-generated defaults
    # (created_at/updated_at) for the response.
    log.info(
        "n8n_user_provisioned",
        supabase_user_id=str(supabase_user_id),
        n8n_user_id=str(invitee_id),
    )
    return link


def _split_name(full_name: str | None) -> tuple[str, str]:
    if not full_name or not full_name.strip():
        return ("Wekala", "User")
    parts = full_name.strip().split(maxsplit=1)
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], parts[1])


# Factory used by FastAPI dependency injection.
def make_n8n_service() -> N8nService:
    return N8nRestAdapter(base_url=settings.n8n_internal_url)
