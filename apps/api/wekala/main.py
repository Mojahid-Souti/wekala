import asyncio
import contextlib
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from wekala.api.v1.router import router
from wekala.core.config import settings
from wekala.db.session import AsyncSessionLocal
from wekala.services.webhook_service import worker as webhook_worker

log = structlog.get_logger()

# Phase 8 — refresh the Command Center materialized view this often (seconds).
_MV_REFRESH_INTERVAL_S = 60


async def _mv_refresh_loop(stop_event: asyncio.Event) -> None:
    """Refresh mv_workspace_daily every 60s.

    CONCURRENTLY keeps read traffic unblocked, but Postgres rejects it until
    the MV has been populated once. First pass is non-CONCURRENT; subsequent
    passes use CONCURRENTLY.
    """
    from sqlalchemy import text as _text

    first = True
    while not stop_event.is_set():
        sql = (
            "REFRESH MATERIALIZED VIEW mv_workspace_daily"
            if first
            else "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_workspace_daily"
        )
        try:
            async with AsyncSessionLocal.begin() as session:
                await session.execute(_text(sql))
            first = False
        except Exception:  # noqa: BLE001 — loop must not die
            log.exception("mv_refresh_failed")
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(stop_event.wait(), timeout=_MV_REFRESH_INTERVAL_S)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    log.info("wekala_api.startup", env=settings.wekala_env)
    webhook_worker.start()
    mv_stop = asyncio.Event()
    mv_task = asyncio.create_task(_mv_refresh_loop(mv_stop), name="mv-refresh-worker")
    try:
        yield
    finally:
        mv_stop.set()
        mv_task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await mv_task
        await webhook_worker.stop()
        log.info("wekala_api.shutdown")


app = FastAPI(
    title="Wekala API",
    version="0.1.0",
    docs_url="/docs" if settings.wekala_env == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/healthz")
async def health() -> dict:  # type: ignore[type-arg]
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Public OpenAPI (Phase 7)
# Strips internal-only endpoints — only `tags=["public"]` and `tags=["webhooks"]`
# (admin self-service for managing event subscriptions) are exposed.
# Used by the SDK generator and by the public docs portal.
# ---------------------------------------------------------------------------

_PUBLIC_TAGS: frozenset[str] = frozenset({"public", "webhooks"})


def _public_openapi() -> dict[str, Any]:
    """Return a filtered OpenAPI 3 document with only public-tagged operations."""
    full = get_openapi(
        title="Wekala Public API",
        version="0.1.0",
        description="External-caller API. Authenticate with `Authorization: Bearer wk_...`.",
        routes=app.routes,
    )
    filtered_paths: dict[str, dict[str, Any]] = {}
    for path, operations in full.get("paths", {}).items():
        kept_ops: dict[str, Any] = {}
        for method, op in operations.items():
            tags = op.get("tags") or []
            if any(tag in _PUBLIC_TAGS for tag in tags):
                kept_ops[method] = op
        if kept_ops:
            filtered_paths[path] = kept_ops
    full["paths"] = filtered_paths
    return full


@app.get("/v1/openapi.json", include_in_schema=False)
async def public_openapi() -> JSONResponse:
    """Filtered OpenAPI spec exposing only public-tagged endpoints."""
    return JSONResponse(_public_openapi())
