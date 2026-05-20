from fastapi import APIRouter

from wekala.api.v1 import agents, auth, bazaar, knowledge_base, workspaces

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(workspaces.router)
router.include_router(agents.router)
router.include_router(bazaar.router)
router.include_router(knowledge_base.router)
