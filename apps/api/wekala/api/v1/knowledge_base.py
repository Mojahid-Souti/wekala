"""Knowledge Base & RAG endpoints.

All routes are scoped under /workspaces/{workspace_id}/kbs so workspace isolation
is enforced at the URL level (require_workspace_role validates membership + OPA).
"""

import uuid
from typing import Annotated, Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.auth.base import UserResult
from wekala.adapters.document_processor.pypdf_adapter import PypdfAdapter
from wekala.adapters.embedding.ollama import OllamaEmbeddingAdapter
from wekala.adapters.storage.supabase import SupabaseStorageAdapter
from wekala.adapters.virus_scanner.clamav import ClamAVAdapter
from wekala.api.deps import check_opa, require_workspace_role
from wekala.core.config import settings
from wekala.core.constants import Action, Role
from wekala.db.session import get_db
from wekala.services.kb_service import KnowledgeBaseService

router = APIRouter(
    prefix="/workspaces/{workspace_id}/kbs",
    tags=["knowledge-base"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateKBRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=2000)
    scope: str = Field(default="workspace", pattern="^(workspace|agent)$")
    agent_id: uuid.UUID | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=10, ge=1, le=50)


class KBOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str
    scope: str
    agent_id: str | None
    status: str
    created_at: str


class DocumentOut(BaseModel):
    id: str
    kb_id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    error_detail: str | None
    page_count: int | None
    token_count: int | None
    created_at: str


class UploadAcceptedOut(BaseModel):
    document_id: str
    status: str
    duplicate: bool
    message: str


class KBListOut(BaseModel):
    items: list[KBOut]
    total: int
    page: int
    size: int


class DocumentListOut(BaseModel):
    items: list[DocumentOut]
    total: int
    page: int
    size: int


class SearchResultItem(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    content: str
    chunk_metadata: dict[str, Any]
    score: float
    rrf_score: float


class SearchOut(BaseModel):
    results: list[SearchResultItem]
    total: int


# ---------------------------------------------------------------------------
# Dependency: build KnowledgeBaseService with all adapters
# ---------------------------------------------------------------------------


def _get_kb_service(db: Annotated[AsyncSession, Depends(get_db)]) -> KnowledgeBaseService:
    return KnowledgeBaseService(
        db=db,
        processor=PypdfAdapter(),
        embedder=OllamaEmbeddingAdapter(
            base_url=settings.ollama_url,
            model=settings.embedding_model,
        ),
        scanner=ClamAVAdapter(
            host=settings.clamav_host,
            port=settings.clamav_port,
        ),
        store=SupabaseStorageAdapter(
            storage_url=settings.supabase_storage_url,
            service_key=settings.wekala_supabase_service_key,
        ),
    )


# ---------------------------------------------------------------------------
# KB endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=KBOut, status_code=status.HTTP_201_CREATED)
async def create_kb(
    workspace_id: uuid.UUID,
    body: CreateKBRequest,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
) -> KBOut:
    current_user, caller_role = caller
    allowed = await check_opa(Action.KB_CREATE, caller_role)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    kb = await svc.create_kb(
        workspace_id=workspace_id,
        name=body.name,
        description=body.description,
        scope=body.scope,
        agent_id=body.agent_id,
        actor_id=current_user.id,
    )
    return KBOut(**kb)


@router.get("", response_model=KBListOut)
async def list_kbs(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> KBListOut:
    result = await svc.list_kbs(workspace_id, page=page, size=size)
    return KBListOut(
        items=[KBOut(**k) for k in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
    )


@router.get("/{kb_id}", response_model=KBOut)
async def get_kb(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
) -> KBOut:
    kb = await svc.get_kb(kb_id, workspace_id)
    return KBOut(**kb)


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
) -> None:
    current_user, caller_role = caller
    allowed = await check_opa(Action.KB_DELETE, caller_role)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    await svc.delete_kb(kb_id, workspace_id, current_user.id)


# ---------------------------------------------------------------------------
# Document endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{kb_id}/documents",
    response_model=UploadAcceptedOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
) -> UploadAcceptedOut:
    current_user, caller_role = caller
    allowed = await check_opa(Action.DOCUMENT_UPLOAD, caller_role)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    result = await svc.upload_document(
        kb_id=kb_id,
        workspace_id=workspace_id,
        actor_id=current_user.id,
        file=file,
        background_tasks=background_tasks,
    )
    return UploadAcceptedOut(
        document_id=result["document_id"],
        status=result["status"],
        duplicate=result["duplicate"],
        message="Already exists" if result["duplicate"] else "Processing started",
    )


@router.get("/{kb_id}/documents", response_model=DocumentListOut)
async def list_documents(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> DocumentListOut:
    result = await svc.list_documents(kb_id, workspace_id, page=page, size=size)
    return DocumentListOut(
        items=[DocumentOut(**d) for d in result["items"]],
        total=result["total"],
        page=result["page"],
        size=result["size"],
    )


@router.get("/{kb_id}/documents/{doc_id}", response_model=DocumentOut)
async def get_document(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
) -> DocumentOut:
    doc = await svc.get_document(doc_id, workspace_id)
    return DocumentOut(**doc)


@router.delete("/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
) -> None:
    current_user, caller_role = caller
    allowed = await check_opa(Action.DOCUMENT_DELETE, caller_role)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    await svc.delete_document(doc_id, workspace_id, current_user.id)


# ---------------------------------------------------------------------------
# Search endpoint
# ---------------------------------------------------------------------------


@router.post("/{kb_id}/search", response_model=SearchOut)
async def search_kb(
    workspace_id: uuid.UUID,
    kb_id: uuid.UUID,
    body: SearchRequest,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    svc: Annotated[KnowledgeBaseService, Depends(_get_kb_service)],
) -> SearchOut:
    caller_role = caller[1]
    allowed = await check_opa(Action.KB_SEARCH, caller_role)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")

    result = await svc.search(kb_id, workspace_id, body.query, top_k=body.top_k)
    items = [
        SearchResultItem(
            chunk_id=str(r["chunk_id"]),
            document_id=str(r["document_id"]),
            filename=r.get("filename", ""),
            content=r["content"],
            chunk_metadata=r.get("chunk_metadata") or {},
            score=float(r.get("score", 0.0)),
            rrf_score=float(r.get("rrf_score", 0.0)),
        )
        for r in result["results"]
    ]
    return SearchOut(results=items, total=result["total"])
