"""BazaarService — catalog, hire, and review business logic.

Responsibilities:
  - Search / list published agents (Meilisearch primary, SQL fallback)
  - Hire / unhire agents into a workspace (idempotent)
  - Submit / update reviews with profanity filtering
  - Index agents into Meilisearch on publish/archive events (called by AgentService)
"""

from __future__ import annotations

import uuid

from better_profanity import profanity
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.search.base import SearchAdapter
from wekala.core.constants import Action, Outcome, ResourceType
from wekala.db.models import Agent, Category, Hire, Review
from wekala.db.repositories.audit import AuditRepository
from wekala.db.repositories.bazaar import BazaarRepository
from wekala.db.repositories.category import CategoryRepository
from wekala.db.repositories.hire import HireRepository
from wekala.db.repositories.review import ReviewRepository

profanity.load_censor_words()


class BazaarService:
    def __init__(self, db: AsyncSession, search: SearchAdapter) -> None:
        self._db = db
        self._search = search
        self._hires = HireRepository(db)
        self._reviews = ReviewRepository(db)
        self._categories = CategoryRepository(db)
        self._bazaar = BazaarRepository(db)
        self._audit = AuditRepository(db)

    # ------------------------------------------------------------------
    # Catalog — search and list
    # ------------------------------------------------------------------

    async def search_catalog(
        self,
        query: str,
        *,
        category_ids: list[uuid.UUID],
        page: int,
        size: int,
        calling_workspace_id: uuid.UUID,
    ) -> dict[str, object]:
        """Search published agents. Meilisearch primary, SQL fallback.

        Enriches each result with hired=bool for the calling workspace.
        Returns paginated catalog response. Hot path: O(log n).
        """
        cat_strs = [str(c) for c in category_ids]

        if query:
            hits, total = await self._search.search(
                query, category_ids=cat_strs, page=page, size=size
            )
            # hits from Meilisearch are dicts; convert to consistent format
            agent_ids = [uuid.UUID(str(h["id"])) for h in hits]
            # Fetch full rows to get authoritative data (search hits may be stale by ms)
            agents = []
            for aid in agent_ids:
                agent = await self._bazaar.get_published(aid)
                if agent:
                    agents.append(agent)
        else:
            cat_filter = category_ids[0] if len(category_ids) == 1 else None
            agents, total = await self._bazaar.list_published(
                category_id=cat_filter, page=page, size=size
            )

        hired_ids = await self._hires.hired_agent_ids(calling_workspace_id)
        items = [self._agent_to_dict(a, hired_ids) for a in agents]
        return {"items": items, "total": total, "page": page, "size": size}

    async def get_agent_detail(
        self, agent_id: uuid.UUID, *, calling_workspace_id: uuid.UUID
    ) -> dict[str, object]:
        """Fetch published agent detail with rating + hired flag. O(1)."""
        agent = await self._bazaar.get_published(agent_id)
        if not agent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        hired_ids = await self._hires.hired_agent_ids(calling_workspace_id)
        d = self._agent_to_dict(agent, hired_ids)
        rating = await self._reviews.avg_rating(agent_id)
        d["rating"] = rating
        category_ids = await self._categories.get_agent_category_ids(agent_id)
        d["category_ids"] = [str(c) for c in category_ids]
        return d

    # ------------------------------------------------------------------
    # Categories
    # ------------------------------------------------------------------

    async def list_categories(self) -> list[Category]:
        """Return all categories. O(n) where n < 100."""
        return await self._categories.list_all()

    # ------------------------------------------------------------------
    # Hire / Unhire
    # ------------------------------------------------------------------

    async def hire(
        self,
        *,
        workspace_id: uuid.UUID,
        agent_id: uuid.UUID,
        hired_by: uuid.UUID,
        background_tasks: BackgroundTasks,
    ) -> Hire:
        """Hire an agent into a workspace. Idempotent: re-hiring same agent is a no-op.

        Only published agents can be hired.
        """
        agent = await self._bazaar.get_published(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found or not published",
            )
        hire = await self._hires.hire(
            workspace_id=workspace_id, agent_id=agent_id, hired_by=hired_by
        )
        await self._db.commit()
        background_tasks.add_task(
            self._audit.record,
            actor_user_id=hired_by,
            actor_workspace_id=workspace_id,
            action=Action.HIRE_CREATE,
            resource_type=ResourceType.HIRE,
            resource_id=hire.id,
            outcome=Outcome.SUCCESS,
        )
        return hire

    async def unhire(
        self,
        *,
        workspace_id: uuid.UUID,
        agent_id: uuid.UUID,
        unhired_by: uuid.UUID,
        background_tasks: BackgroundTasks,
    ) -> None:
        """Remove a hire. 404 if not hired."""
        deleted = await self._hires.unhire(workspace_id=workspace_id, agent_id=agent_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not hired")
        await self._db.commit()
        background_tasks.add_task(
            self._audit.record,
            actor_user_id=unhired_by,
            actor_workspace_id=workspace_id,
            action=Action.HIRE_VIEW,  # reuse for unhire audit
            resource_type=ResourceType.HIRE,
            resource_id=agent_id,
            outcome=Outcome.SUCCESS,
        )

    async def list_hires(
        self,
        workspace_id: uuid.UUID,
        *,
        page: int,
        size: int,
    ) -> dict[str, object]:
        """List agents hired by a workspace, with agent detail. O(log n)."""
        hires, total = await self._hires.list(workspace_id, page=page, size=size)
        items = []
        for h in hires:
            agent = await self._bazaar.get_published(h.agent_id)
            if agent:
                d = self._agent_to_dict(agent, {h.agent_id})
                d["hired_at"] = h.hired_at.isoformat()
                items.append(d)
        return {"items": items, "total": total, "page": page, "size": size}

    # ------------------------------------------------------------------
    # Reviews
    # ------------------------------------------------------------------

    async def submit_review(
        self,
        *,
        agent_id: uuid.UUID,
        workspace_id: uuid.UUID,
        author_id: uuid.UUID,
        rating: int,
        body: str,
        background_tasks: BackgroundTasks,
    ) -> Review:
        """Create or update a review. Profanity-filtered. One review per user per agent."""
        agent = await self._bazaar.get_published(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found or not published"
            )
        clean_body = profanity.censor(body)
        review = await self._reviews.upsert(
            agent_id=agent_id,
            workspace_id=workspace_id,
            author_id=author_id,
            rating=rating,
            body=clean_body,
        )
        await self._db.commit()
        background_tasks.add_task(
            self._audit.record,
            actor_user_id=author_id,
            actor_workspace_id=workspace_id,
            action=Action.REVIEW_CREATE,
            resource_type=ResourceType.REVIEW,
            resource_id=review.id,
            outcome=Outcome.SUCCESS,
        )
        return review

    async def list_reviews(self, agent_id: uuid.UUID, *, page: int, size: int) -> dict[str, object]:
        """Paginated reviews for an agent. O(log n)."""
        reviews, total = await self._reviews.list(agent_id, page=page, size=size)
        items = [
            {
                "id": str(r.id),
                "author_id": str(r.author_id),
                "rating": r.rating,
                "body": r.body,
                "created_at": r.created_at.isoformat(),
            }
            for r in reviews
        ]
        return {"items": items, "total": total, "page": page, "size": size}

    # ------------------------------------------------------------------
    # Indexing (called by AgentService on publish/archive)
    # ------------------------------------------------------------------

    async def index_agent(self, agent: Agent) -> None:
        """Upsert agent into Meilisearch. Called as background task on publish. O(s)."""
        category_ids = await self._categories.get_agent_category_ids(agent.id)
        doc: dict[str, object] = {
            "id": str(agent.id),
            "name": agent.name,
            "description": agent.description,
            "tags": agent.tags,
            "status": agent.status,
            "language": agent.language,
            "classification": agent.classification,
            "category_ids": [str(c) for c in category_ids],
            "updated_at": agent.updated_at.isoformat(),
        }
        await self._search.index_agent(doc)

    async def deindex_agent(self, agent_id: uuid.UUID) -> None:
        """Remove agent from Meilisearch. Called as background task on archive. O(1)."""
        await self._search.delete_agent(str(agent_id))

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _agent_to_dict(self, agent: Agent, hired_ids: set[uuid.UUID]) -> dict[str, object]:
        return {
            "id": str(agent.id),
            "name": agent.name,
            "description": agent.description,
            "tags": agent.tags,
            "status": agent.status,
            "language": agent.language,
            "classification": agent.classification,
            "owner_id": str(agent.owner_id),
            "workspace_id": str(agent.workspace_id),
            "version": agent.version,
            "created_at": agent.created_at.isoformat(),
            "updated_at": agent.updated_at.isoformat(),
            "hired": agent.id in hired_ids,
        }
