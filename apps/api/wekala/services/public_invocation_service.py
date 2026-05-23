"""Public agent invocation — the external-callers hot path.

Flow:
  1. ApiCaller already resolved by `get_api_caller` dependency
  2. Rate-limit check (returns 429 with Retry-After on bust)
  3. Resolve agent in the API key's workspace
  4. Gate: agent must be status='published' AND vetting_status='approved'
  5. Call AgentRuntime.invoke (Dify adapter)
  6. Record `api_request_log` row (always, even on failure)
  7. Audit log: action=public.invoke

Webhook fan-out (agent.invoked / agent.failed) happens via WebhookService —
we enqueue a delivery row; the long-running worker actually sends.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.agent_runtime.base import AgentRuntime
from wekala.core.constants import Action, AgentStatus, Outcome, ResourceType
from wekala.db.repositories.agent import AgentRepository
from wekala.db.repositories.audit import AuditRepository
from wekala.services.rate_limit_service import RateLimitService


@dataclass(frozen=True)
class InvocationResult:
    answer: str
    usage: dict[str, Any]
    latency_ms: int


class PublicInvocationService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        runtime: AgentRuntime,
        rate_limiter: RateLimitService,
    ) -> None:
        self._db = db
        self._agents = AgentRepository(db)
        self._audit = AuditRepository(db)
        self._runtime = runtime
        self._rate_limiter = rate_limiter

    async def invoke(
        self,
        *,
        agent_id: uuid.UUID,
        workspace_id: uuid.UUID,
        api_key_id: uuid.UUID,
        query: str,
    ) -> InvocationResult:
        rl = await self._rate_limiter.check(api_key_id)
        if not rl.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Rate limit exceeded: {rl.requests_last_minute}/min, "
                    f"{rl.requests_today}/day. Retry in {rl.retry_after_seconds}s."
                ),
                headers={
                    "Retry-After": str(rl.retry_after_seconds),
                    "X-RateLimit-Limit": str(rl.limit_minute),
                    "X-RateLimit-Remaining": str(max(0, rl.limit_minute - rl.requests_last_minute)),
                },
            )

        agent = await self._agents.get(agent_id, workspace_id)
        if not agent:
            await self._rate_limiter.record(
                api_key_id=api_key_id,
                workspace_id=workspace_id,
                agent_id=None,
                endpoint="invoke",
                status_code=404,
                latency_ms=0,
            )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

        # Phase 6 + 2 gate: only Published + Approved agents are externally callable.
        if agent.status != AgentStatus.PUBLISHED or agent.vetting_status != "approved":
            await self._rate_limiter.record(
                api_key_id=api_key_id,
                workspace_id=workspace_id,
                agent_id=agent.id,
                endpoint="invoke",
                status_code=409,
                latency_ms=0,
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Agent is not externally callable: "
                    f"status={agent.status!r}, vetting_status={agent.vetting_status!r}. "
                    "Required: status='published' and vetting_status='approved'."
                ),
            )

        start = time.perf_counter()
        outcome = Outcome.SUCCESS
        try:
            result = await self._runtime.invoke(agent, query)
            answer = str(result.get("answer", ""))
            usage = dict(result.get("usage", {}))
        except Exception as exc:  # noqa: BLE001 — translate to 502, record audit, re-raise
            outcome = Outcome.FAILURE
            latency_ms = int((time.perf_counter() - start) * 1000)
            await self._rate_limiter.record(
                api_key_id=api_key_id,
                workspace_id=workspace_id,
                agent_id=agent.id,
                endpoint="invoke",
                status_code=502,
                latency_ms=latency_ms,
            )
            await self._audit.record(
                action=Action.PUBLIC_INVOKE,
                outcome=outcome,
                actor_user_id=None,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.AGENT,
                resource_id=agent.id,
                metadata={"api_key_id": str(api_key_id), "error": str(exc)[:200]},
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Agent runtime failed: {exc}",
            ) from exc

        latency_ms = int((time.perf_counter() - start) * 1000)

        await self._rate_limiter.record(
            api_key_id=api_key_id,
            workspace_id=workspace_id,
            agent_id=agent.id,
            endpoint="invoke",
            status_code=200,
            latency_ms=latency_ms,
        )
        await self._audit.record(
            action=Action.PUBLIC_INVOKE,
            outcome=outcome,
            actor_user_id=None,
            actor_workspace_id=workspace_id,
            resource_type=ResourceType.AGENT,
            resource_id=agent.id,
            metadata={"api_key_id": str(api_key_id), "latency_ms": latency_ms},
        )
        return InvocationResult(answer=answer, usage=usage, latency_ms=latency_ms)
