"""Repositories for Knowledge Base, KBDocument, and KBChunk.

Query complexity:
  list_kbs:          O(log n) via ix_kbs_workspace_id
  list_documents:    O(log n) via ix_kb_documents_kb_status_created
  vector_search:     O(log n) via HNSW ix_kb_chunks_embedding_hnsw
  document by hash:  O(log n) via ix_kb_documents_hash (dedup check)
"""

import uuid
from typing import Any

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.db.models import KBChunk, KBDocument, KnowledgeBase


class KBRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        *,
        workspace_id: uuid.UUID,
        name: str,
        description: str,
        scope: str,
        agent_id: uuid.UUID | None,
        created_by: uuid.UUID,
    ) -> KnowledgeBase:
        kb = KnowledgeBase(
            workspace_id=workspace_id,
            name=name,
            description=description,
            scope=scope,
            agent_id=agent_id,
            created_by=created_by,
        )
        self._db.add(kb)
        await self._db.flush()
        return kb

    async def get(self, kb_id: uuid.UUID, workspace_id: uuid.UUID) -> KnowledgeBase | None:
        result = await self._db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.id == kb_id,
                KnowledgeBase.workspace_id == workspace_id,
                KnowledgeBase.status == "active",
            )
        )
        return result.scalar_one_or_none()

    async def list_by_workspace(
        self, workspace_id: uuid.UUID, *, page: int, size: int
    ) -> tuple[list[KnowledgeBase], int]:
        base = select(KnowledgeBase).where(
            KnowledgeBase.workspace_id == workspace_id,
            KnowledgeBase.status == "active",
        )
        total_result = await self._db.execute(select(func.count()).select_from(base.subquery()))
        total = total_result.scalar_one()
        items_result = await self._db.execute(
            base.order_by(KnowledgeBase.created_at.desc()).offset((page - 1) * size).limit(size)
        )
        return list(items_result.scalars()), total

    async def archive(self, kb_id: uuid.UUID, workspace_id: uuid.UUID) -> None:
        await self._db.execute(
            update(KnowledgeBase)
            .where(
                KnowledgeBase.id == kb_id,
                KnowledgeBase.workspace_id == workspace_id,
            )
            .values(status="archived")
        )


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(
        self,
        *,
        kb_id: uuid.UUID,
        workspace_id: uuid.UUID,
        uploaded_by: uuid.UUID,
        filename: str,
        file_type: str,
        file_size: int,
        storage_path: str,
        content_hash: str,
    ) -> KBDocument:
        doc = KBDocument(
            kb_id=kb_id,
            workspace_id=workspace_id,
            uploaded_by=uploaded_by,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            content_hash=content_hash,
        )
        self._db.add(doc)
        await self._db.flush()
        return doc

    async def get(self, doc_id: uuid.UUID, workspace_id: uuid.UUID) -> KBDocument | None:
        result = await self._db.execute(
            select(KBDocument).where(
                KBDocument.id == doc_id,
                KBDocument.workspace_id == workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def find_duplicate(self, kb_id: uuid.UUID, content_hash: str) -> KBDocument | None:
        """Check for duplicate file in same KB by SHA-256 hash. O(log n) via hash index."""
        result = await self._db.execute(
            select(KBDocument).where(
                KBDocument.kb_id == kb_id,
                KBDocument.content_hash == content_hash,
                KBDocument.status != "failed",
            )
        )
        return result.scalar_one_or_none()

    async def list_by_kb(
        self, kb_id: uuid.UUID, workspace_id: uuid.UUID, *, page: int, size: int
    ) -> tuple[list[KBDocument], int]:
        base = select(KBDocument).where(
            KBDocument.kb_id == kb_id,
            KBDocument.workspace_id == workspace_id,
        )
        total = (
            await self._db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar_one()
        items = (
            await self._db.execute(
                base.order_by(KBDocument.created_at.desc()).offset((page - 1) * size).limit(size)
            )
        ).scalars()
        return list(items), total

    async def set_status(
        self,
        doc_id: uuid.UUID,
        status: str,
        *,
        error_detail: str | None = None,
        page_count: int | None = None,
        token_count: int | None = None,
        doc_metadata: dict[str, Any] | None = None,
    ) -> None:
        values: dict[str, Any] = {"status": status}
        if error_detail is not None:
            values["error_detail"] = error_detail
        if page_count is not None:
            values["page_count"] = page_count
        if token_count is not None:
            values["token_count"] = token_count
        if doc_metadata is not None:
            values["metadata"] = doc_metadata
        await self._db.execute(update(KBDocument).where(KBDocument.id == doc_id).values(**values))

    async def delete(self, doc_id: uuid.UUID, workspace_id: uuid.UUID) -> str | None:
        """Delete document; return storage_path for caller to remove from object store."""
        result = await self._db.execute(
            select(KBDocument.storage_path).where(
                KBDocument.id == doc_id,
                KBDocument.workspace_id == workspace_id,
            )
        )
        path = result.scalar_one_or_none()
        if path:
            await self._db.execute(delete(KBDocument).where(KBDocument.id == doc_id))
        return path


class ChunkRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def bulk_insert(self, chunks: list[KBChunk]) -> None:
        """Insert all chunks for a document in one flush. O(k) where k = chunk count."""
        for chunk in chunks:
            self._db.add(chunk)
        await self._db.flush()

    async def vector_search(
        self,
        embedding: list[float],
        kb_id: uuid.UUID,
        workspace_id: uuid.UUID,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        """Cosine similarity search via HNSW index. O(log n) where n = chunks in KB.

        Returns list of dicts: {chunk_id, document_id, content, chunk_metadata, score}.
        """
        vec_literal = "[" + ",".join(str(v) for v in embedding) + "]"
        sql = text("""
            SELECT
                c.id            AS chunk_id,
                c.document_id,
                c.content,
                c.metadata      AS chunk_metadata,
                d.filename,
                1 - (c.embedding <=> :embedding ::vector) AS score
            FROM kb_chunks c
            JOIN kb_documents d ON d.id = c.document_id
            WHERE c.kb_id = :kb_id
              AND c.workspace_id = :workspace_id
              AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> :embedding ::vector
            LIMIT :top_k
        """)
        result = await self._db.execute(
            sql,
            {
                "embedding": vec_literal,
                "kb_id": str(kb_id),
                "workspace_id": str(workspace_id),
                "top_k": top_k,
            },
        )
        return [dict(row._mapping) for row in result]

    async def delete_by_document(self, document_id: uuid.UUID) -> None:
        await self._db.execute(delete(KBChunk).where(KBChunk.document_id == document_id))
