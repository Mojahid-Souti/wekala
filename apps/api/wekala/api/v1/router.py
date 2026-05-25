from fastapi import APIRouter

from wekala.api.v1 import (
    agents,
    analytics,
    auth,
    bazaar,
    knowledge_base,
    n8n,
    public,
    tools,
    users,
    vetting,
    webhooks,
    workspaces,
)

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(workspaces.router)
router.include_router(agents.router)
router.include_router(bazaar.router)
router.include_router(knowledge_base.router)
router.include_router(users.router)
router.include_router(tools.router)
router.include_router(vetting.router)
# Phase 7
router.include_router(public.router)
router.include_router(webhooks.router)
# Phase 8
router.include_router(analytics.router)
# Phase B multi-tenancy — n8n session bridge
router.include_router(n8n.router)
