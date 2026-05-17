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

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.wekala_cors_origins.split(",")]


settings = Settings()  # type: ignore[call-arg]
