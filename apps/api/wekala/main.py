from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from wekala.api.v1.router import router
from wekala.core.config import settings

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    log.info("wekala_api.startup", env=settings.wekala_env)
    yield
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
