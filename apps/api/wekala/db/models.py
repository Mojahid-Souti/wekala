import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# Stub for the Supabase-managed auth.users table. Registered here so SQLAlchemy
# can resolve cross-schema ForeignKey references at the Python layer.
# Never created or dropped by our Alembic migrations (env.py filters it out).
Table(
    "users",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    schema="auth",
)


class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 2 AND 100", name="workspace_name_length"),
        CheckConstraint("slug ~ '^[a-z0-9-]+$'", name="workspace_slug_format"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
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


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 2 AND 100", name="agent_name_length"),
        CheckConstraint(
            "status IN ('draft','in_review','published','archived')", name="agent_valid_status"
        ),
        CheckConstraint(
            "classification IN ('public','internal','restricted','confidential')",
            name="agent_valid_classification",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # type: ignore[type-arg]
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    classification: Mapped[str] = mapped_column(String(20), nullable=False, default="internal")
    dify_app_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Phase 6 — safety review state, independent of lifecycle `status`.
    vetting_status: Mapped[str] = mapped_column(String(30), nullable=False, default="unvetted")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class AgentVersion(Base):
    __tablename__ = "agent_versions"
    __table_args__ = (UniqueConstraint("agent_id", "version_num", name="uq_agent_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_num: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    dify_dsl: Mapped[dict] = mapped_column(JSONB, nullable=False)  # type: ignore[type-arg]
    changed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    change_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class AgentImport(Base):
    __tablename__ = "agent_imports"
    __table_args__ = (
        CheckConstraint("source IN ('yaml_upload','template')", name="agent_import_valid_source"),
        CheckConstraint("status IN ('success','failed')", name="agent_import_valid_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
    )
    imported_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Truncated at 10_000 chars for audit; full DSL lives in agent_versions
    raw_yaml: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class Hire(Base):
    __tablename__ = "hires"
    __table_args__ = (UniqueConstraint("workspace_id", "agent_id", name="uq_hire"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    hired_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    hired_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("agent_id", "author_id", name="uq_review"),
        CheckConstraint("rating BETWEEN 1 AND 5", name="review_valid_rating"),
        CheckConstraint("char_length(body) <= 2000", name="review_body_max"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 2 AND 50", name="category_name_length"),
        CheckConstraint("slug ~ '^[a-z0-9-]+$'", name="category_slug_format"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)


class AgentCategory(Base):
    __tablename__ = "agent_categories"
    __table_args__ = (UniqueConstraint("agent_id", "category_id", name="uq_agent_category"),)

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )


# ---------------------------------------------------------------------------
# Phase 4 — Knowledge Base & RAG
# ---------------------------------------------------------------------------


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    __table_args__ = (
        CheckConstraint("char_length(name) BETWEEN 2 AND 100", name="kb_name_length"),
        CheckConstraint("scope IN ('workspace','agent')", name="kb_valid_scope"),
        CheckConstraint("status IN ('active','archived')", name="kb_valid_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 'workspace' = shared KB; 'agent' = private to one agent
    scope: Mapped[str] = mapped_column(String(20), nullable=False, default="workspace")
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class KBDocument(Base):
    """Represents one uploaded file within a KnowledgeBase."""

    __tablename__ = "kb_documents"
    __table_args__ = (
        CheckConstraint("file_type IN ('pdf','docx','txt','md','html')", name="kb_doc_valid_type"),
        CheckConstraint(
            "status IN ('pending','processing','ready','failed')", name="kb_doc_valid_status"
        ),
        CheckConstraint("file_size > 0", name="kb_doc_positive_size"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    # Path in Supabase Storage: ws/{workspace_id}/kb/{kb_id}/{doc_id}/{filename}
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hex
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    doc_metadata: Mapped[dict] = mapped_column(  # type: ignore[type-arg]
        "metadata", JSONB, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class KBChunk(Base):
    """One semantic chunk of a KBDocument with its embedding vector."""

    __tablename__ = "kb_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_chunk"),
        CheckConstraint("token_count > 0", name="kb_chunk_positive_tokens"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kb_documents.id", ondelete="CASCADE"), nullable=False
    )
    kb_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # embedding stored as text (pgvector type registered in migration) — None until embedded
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_metadata: Mapped[dict] = mapped_column(  # type: ignore[type-arg]
        "metadata", JSONB, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class KBJob(Base):
    """A queued document-processing job, drained by the dedicated worker.

    The API enqueues one row per upload (status='queued') and NOTIFYs the
    'kb_jobs' channel; the worker claims it with FOR UPDATE SKIP LOCKED, runs
    the parse->embed pipeline out-of-process, and marks it done/failed. Keeping
    this off the API event loop is what stops a burst of uploads taking the API
    down.
    """

    __tablename__ = "kb_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','processing','done','failed')", name="kb_job_valid_status"
        ),
        CheckConstraint("attempts >= 0", name="kb_job_attempts_nonneg"),
        Index("ix_kb_jobs_claim", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kb_documents.id", ondelete="CASCADE"), nullable=False
    )
    kb_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


# =============================================================================
# Phase 5 — Tools, MCP & integrations
# =============================================================================


class MCPServer(Base):
    """A Model Context Protocol server registered by a workspace admin.

    Built-ins are flagged `is_builtin=True` and bypass the SSRF check during
    registration (their URLs point at trusted Docker-network sidecars).
    """

    __tablename__ = "mcp_servers"
    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_mcp_server_workspace_name"),
        CheckConstraint("char_length(name) BETWEEN 2 AND 100", name="mcp_server_name_length"),
        CheckConstraint("transport IN ('http')", name="mcp_server_transport"),
        CheckConstraint("status IN ('active','disabled')", name="mcp_server_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    url: Mapped[str] = mapped_column(Text, nullable=False)
    transport: Mapped[str] = mapped_column(String(20), nullable=False, default="http")
    is_builtin: Mapped[bool] = mapped_column(nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    registered_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    # Tier-1 auth (Phase 5 ext): static token/API key sent as a header on every
    # call. Fernet-encrypted at rest; never returned to the client. NULL = no auth.
    auth_value_encrypted: Mapped[bytes | None] = mapped_column(nullable=True)
    auth_header: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Authorization", server_default="Authorization"
    )
    auth_scheme: Mapped[str] = mapped_column(
        String(20), nullable=False, default="Bearer", server_default="Bearer"
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Tool(Base):
    """A tool exposed by an MCP server. Discovered via the server's tools/list call.

    `mcp_server_id` is NOT NULL — every tool belongs to an MCP server. The
    `tools/list` response is cached here; re-discovery overwrites the row.
    """

    __tablename__ = "tools"
    __table_args__ = (
        UniqueConstraint("mcp_server_id", "name", name="uq_tool_server_name"),
        CheckConstraint("char_length(name) BETWEEN 1 AND 200", name="tool_name_length"),
        CheckConstraint("status IN ('active','disabled')", name="tool_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mcp_server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mcp_servers.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    input_schema: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # type: ignore[type-arg]
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class AgentTool(Base):
    """Per-agent tool whitelist. Composite PK (agent_id, tool_id)."""

    __tablename__ = "agent_tools"

    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    granted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    granted_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class ToolInvocation(Base):
    """Audit row for every tool/call. Workspace-scoped via FK + RLS."""

    __tablename__ = "tool_invocations"
    __table_args__ = (
        CheckConstraint(
            "outcome IN ('success','failure','timeout')", name="tool_invocation_outcome"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    tool_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tools.id", ondelete="SET NULL"), nullable=True
    )
    caller_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True
    )
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    input_preview: Mapped[str] = mapped_column(Text, nullable=False, default="")
    output_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    output_preview: Mapped[str] = mapped_column(Text, nullable=False, default="")
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


# =============================================================================
# Phase 6 — Security Gatekeeper & PDPL
# =============================================================================


class VettingRun(Base):
    """One safety review of an agent. Fail-closed: status starts at 'scanning'
    and only completes when every scanner returns or errors. UI polls this row.
    """

    __tablename__ = "vetting_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('scanning','completed','failed')", name="vetting_run_valid_status"
        ),
        CheckConstraint(
            "outcome IS NULL OR outcome IN ('ready_for_review','auto_approved','rejected','error')",
            name="vetting_run_valid_outcome",
        ),
        CheckConstraint(
            "approval_decision IS NULL OR approval_decision IN ('approved','rejected')",
            name="vetting_run_valid_approval",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    agent_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="scanning")
    outcome: Mapped[str | None] = mapped_column(String(30), nullable=True)
    classification: Mapped[str] = mapped_column(String(20), nullable=False)
    triggered_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True
    )
    approval_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    approval_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    finding_summary: Mapped[dict] = mapped_column(  # type: ignore[type-arg]
        JSONB, nullable=False, default=dict
    )
    started_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class VettingFinding(Base):
    """A single issue detected by a scanner during one VettingRun.

    `matched_full` holds the unredacted matched text; only workspace admins
    can read it (enforced at the service/API layer — RLS allows row access).
    `matched_preview` is a safe-to-display redacted version.
    """

    __tablename__ = "vetting_findings"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('info','low','medium','high','critical')",
            name="vetting_finding_valid_severity",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vetting_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vetting_runs.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    finding_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    location: Mapped[str] = mapped_column(String(50), nullable=False)
    matched_preview: Mapped[str] = mapped_column(Text, nullable=False, default="")
    matched_full: Mapped[str | None] = mapped_column(Text, nullable=True)
    finding_metadata: Mapped[dict] = mapped_column(  # type: ignore[type-arg]
        "finding_metadata", JSONB, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


# =============================================================================
# Phase 7 — Developer SDK & API
# =============================================================================


class ApiRequestLog(Base):
    """Every external (API-key-authenticated) request. Source for rate limiting + analytics."""

    __tablename__ = "api_request_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_key_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    status_code: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ts: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


class WebhookSubscription(Base):
    """Per-workspace event subscription. `secret_hash` is Argon2id of the HMAC secret
    (shown once on creation, never again)."""

    __tablename__ = "webhook_subscriptions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','paused','disabled')", name="webhook_subscription_status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    events: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    # Plaintext HMAC signing secret (NOT hashed — we need to read it to
    # sign payloads; receivers verify with the same bytes). Encrypt-at-rest
    # via an app key is a follow-on.
    signing_secret: Mapped[str] = mapped_column(Text, nullable=False)
    secret_prefix: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )


class WebhookDelivery(Base):
    """Durable per-event delivery state. Worker reads `status='pending'` rows
    whose `next_attempt_at <= now()` and attempts HMAC-signed POST.
    """

    __tablename__ = "webhook_deliveries"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','success','failed','dead')",
            name="webhook_delivery_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("webhook_subscriptions.id", ondelete="CASCADE"),
        nullable=False,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    event: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)  # type: ignore[type-arg]
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, default=uuid.uuid4
    )
    attempt_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    last_attempt_at: Mapped[datetime | None] = mapped_column(nullable=True)
    next_attempt_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_status_code: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


# =============================================================================
# Phase 8 — Command Center & analytics
# =============================================================================


class AnomalyAlert(Base):
    """An automatically-detected metric anomaly. Reviewed by workspace admins."""

    __tablename__ = "anomaly_alerts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','acknowledged','resolved')", name="anomaly_alert_status"
        ),
        CheckConstraint("threshold_kind IN ('zscore','absolute')", name="anomaly_threshold_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    metric_name: Mapped[str] = mapped_column(String(80), nullable=False)
    threshold_kind: Mapped[str] = mapped_column(String(20), nullable=False)
    threshold_value: Mapped[float] = mapped_column(nullable=False)
    observed_value: Mapped[float] = mapped_column(nullable=False)
    window_start: Mapped[datetime] = mapped_column(nullable=False)
    window_end: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(nullable=True)
    alert_metadata: Mapped[dict] = mapped_column(  # type: ignore[type-arg]
        "alert_metadata", JSONB, nullable=False, default=dict
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())


# =============================================================================
# Phase B multi-tenancy — Wekala↔n8n user mapping
# =============================================================================


class N8nUserLink(Base):
    """One-to-one mapping from a Supabase user to a private n8n user.

    Created on first canvas access by services/n8n_provisioning.py. The
    n8n_password_encrypted column is Fernet-encrypted with
    WEKALA_FIELD_ENCRYPTION_KEY so a DB leak doesn't expose plaintext n8n
    passwords. Plaintext passwords are never logged.
    """

    __tablename__ = "n8n_user_links"

    supabase_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    n8n_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    n8n_email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    n8n_password_encrypted: Mapped[bytes] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default=func.now(), onupdate=func.now()
    )
