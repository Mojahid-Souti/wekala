from pydantic import AnyHttpUrl, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    wekala_env: str = "development"
    wekala_secret_key: str
    wekala_cors_origins: str = "http://localhost:3002"

    # Database — connects directly to Supabase Postgres
    database_url: PostgresDsn

    # Supabase / GoTrue
    wekala_supabase_url: AnyHttpUrl
    wekala_supabase_service_key: str
    supabase_jwt_secret: str

    # OPA
    opa_url: str = "http://opa:8181"

    # Dify agent runtime
    dify_base_url: str = "http://dify-api:5001"
    dify_console_token: str = ""  # required in production; empty disables Dify calls

    # Agent sandbox quota (invocations per user per day)
    agent_sandbox_daily_quota: int = 100

    # Meilisearch
    meilisearch_url: str = "http://wekala-meilisearch:7700"
    meilisearch_master_key: str = ""  # MEILI_MASTER_KEY from env

    # Knowledge Base & RAG (Phase 4)
    clamav_host: str = "wekala-clamav"
    clamav_port: int = 3310
    ollama_url: str = "http://ollama:11434"
    embedding_model: str = "bge-m3"
    embedding_batch_size: int = 32
    document_max_mb: int = 50
    document_chunk_tokens: int = 1024
    document_chunk_overlap: int = 128
    supabase_storage_url: str = "http://supabase-storage:5000"

    # Tools / MCP (Phase 5)
    # Comma-separated hostnames that bypass the SSRF guard. Used for trusted
    # Docker-network sidecars (wekala-mcp-*) registered as built-in tools.
    mcp_builtin_hostnames: str = ""

    # Developer SDK & API (Phase 7)
    # Per-key sliding-window limits. Defaults match the CLAUDE.md plan.
    api_rate_limit_per_minute: int = 60
    api_rate_limit_per_day: int = 10_000
    # Webhook delivery: exponential backoff (1s, 5s, 25s, 2m, 10m), max 5 attempts.
    webhook_max_attempts: int = 5
    webhook_initial_backoff_s: int = 1
    webhook_delivery_timeout_s: float = 10.0
    # Worker tick interval — how often the delivery worker scans for due retries.
    webhook_worker_interval_s: int = 5

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.wekala_cors_origins.split(",")]

    @property
    def mcp_builtin_hostname_set(self) -> frozenset[str]:
        return frozenset(h.strip() for h in self.mcp_builtin_hostnames.split(",") if h.strip())


settings = Settings()  # type: ignore[call-arg]
