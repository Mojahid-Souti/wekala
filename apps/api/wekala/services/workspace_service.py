import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from wekala.core.constants import Action, Outcome, ResourceType, Role
from wekala.db.models import Membership, Workspace
from wekala.db.repositories.audit import AuditRepository
from wekala.db.repositories.membership import MembershipRepository
from wekala.db.repositories.workspace import WorkspaceRepository


def _slugify(name: str) -> str:
    """Convert name to lowercase-hyphenated slug. E.g. 'My Workspace' → 'my-workspace'."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:80]


class WorkspaceService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._workspaces = WorkspaceRepository(db)
        self._memberships = MembershipRepository(db)
        self._audit = AuditRepository(db)

    async def create(self, name: str, owner_id: uuid.UUID) -> Workspace:
        """Create workspace and make owner an Admin member. O(1) writes."""
        slug = await self._unique_slug(_slugify(name))

        async with self._db.begin_nested():
            ws = await self._workspaces.create(name=name, slug=slug, owner_id=owner_id)
            await self._memberships.create(workspace_id=ws.id, user_id=owner_id, role=Role.ADMIN)
            await self._audit.record(
                action=Action.WORKSPACE_UPDATE,
                outcome=Outcome.SUCCESS,
                actor_user_id=owner_id,
                actor_workspace_id=ws.id,
                resource_type=ResourceType.WORKSPACE,
                resource_id=ws.id,
            )

        return ws

    async def invite(
        self,
        workspace_id: uuid.UUID,
        inviter_id: uuid.UUID,
        invitee_id: uuid.UUID,
        role: Role,
    ) -> Membership:
        async with self._db.begin_nested():
            m = await self._memberships.create(
                workspace_id=workspace_id,
                user_id=invitee_id,
                role=role,
                invited_by=inviter_id,
            )
            await self._audit.record(
                action=Action.WORKSPACE_INVITE,
                outcome=Outcome.SUCCESS,
                actor_user_id=inviter_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.MEMBERSHIP,
                resource_id=m.id,
            )
        return m

    async def update_role(
        self,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID,
        target_user_id: uuid.UUID,
        new_role: Role,
    ) -> Membership | None:
        async with self._db.begin_nested():
            m = await self._memberships.update_role(workspace_id, target_user_id, new_role)
            if m:
                await self._audit.record(
                    action=Action.MEMBERSHIP_UPDATE,
                    outcome=Outcome.SUCCESS,
                    actor_user_id=actor_id,
                    actor_workspace_id=workspace_id,
                    resource_type=ResourceType.MEMBERSHIP,
                    resource_id=m.id,
                )
        return m

    async def remove_member(
        self, workspace_id: uuid.UUID, actor_id: uuid.UUID, target_user_id: uuid.UUID
    ) -> None:
        async with self._db.begin_nested():
            await self._memberships.remove(workspace_id, target_user_id)
            await self._audit.record(
                action=Action.MEMBERSHIP_UPDATE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.MEMBERSHIP,
            )

    async def _unique_slug(self, base: str) -> str:
        """Append numeric suffix if slug is taken. Max 5 attempts."""
        slug = base
        for i in range(1, 6):
            if not await self._workspaces.slug_exists(slug):
                return slug
            slug = f"{base}-{i}"
        return f"{base}-{uuid.uuid4().hex[:6]}"
