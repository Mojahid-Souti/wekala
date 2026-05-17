import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.db.models import Membership, Workspace


class WorkspaceRepository:
    """All Workspace DB queries. O(log n) via index on (workspace_id, user_id)."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, name: str, slug: str, owner_id: uuid.UUID) -> Workspace:
        ws = Workspace(name=name, slug=slug, owner_id=owner_id)
        self._db.add(ws)
        await self._db.flush()
        return ws

    async def get(self, workspace_id: uuid.UUID) -> Workspace | None:
        return await self._db.get(Workspace, workspace_id)

    async def get_by_slug(self, slug: str) -> Workspace | None:
        result = await self._db.execute(select(Workspace).where(Workspace.slug == slug))
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: uuid.UUID) -> list[Workspace]:
        """O(k) where k = workspaces for this user; always < 100 in practice."""
        result = await self._db.execute(
            select(Workspace)
            .join(Membership, Membership.workspace_id == Workspace.id)
            .where(Membership.user_id == user_id)
            .order_by(Workspace.created_at.desc())
        )
        return list(result.scalars().all())

    async def slug_exists(self, slug: str) -> bool:
        result = await self._db.execute(select(Workspace.id).where(Workspace.slug == slug).limit(1))
        return result.scalar_one_or_none() is not None
