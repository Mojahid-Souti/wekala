import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 2 AND 100", name="workspace_name_length"),
        CheckConstraint("slug ~ '^[a-z0-9-]+$'", name="workspace_slug_format"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # type: ignore[type-arg]
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_membership"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint(
            "role IN ('admin','builder','reviewer','hirer','viewer')", name="valid_role"
        ),
        nullable=False,
    )
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class AuditLog(Base):
    """ECS-compatible audit record. Never exposes PII in action/resource fields."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True
    )
    actor_workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    outcome: Mapped[str] = mapped_column(
        String(10),
        CheckConstraint("outcome IN ('success','failure')", name="valid_outcome"),
        nullable=False,
    )
    # "metadata" is reserved by SQLAlchemy's DeclarativeBase — use event_metadata as the ORM
    # attribute; the DB column is named "metadata" via the Column name argument.
    event_metadata: Mapped[dict] = mapped_column(  # type: ignore[type-arg]
        "metadata", JSONB, nullable=False, default=dict
    )
    trace_id: Mapped[str | None] = mapped_column(Text, nullable=True)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    key_hash: Mapped[str] = mapped_column(Text, nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(8), nullable=False)
    scopes: Mapped[list] = mapped_column(JSONB, nullable=False, default=lambda: ["invoke"])  # type: ignore[type-arg]
    last_used_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(nullable=True)
