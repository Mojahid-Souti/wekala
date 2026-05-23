"""Read-only dashboard aggregations.

All queries are workspace-scoped (the API layer enforces role; this layer
takes workspace_id as a required argument). Materialized view
`mv_workspace_daily` is refreshed every 60s by a background task.
Per-agent and timeseries queries hit `mv_workspace_daily` when possible,
falling back to the raw tables for the per-agent slice.

Algorithmic complexity:
  - KPI summary: O(d) where d = days in window (typ. 7 or 30) — single MV scan
  - Timeseries: O(d) — single MV scan
  - Top-N agents: O(n log n) over agents touched in window — small (~< 100)
  - Per-agent metrics: O(r) where r = api_request_log rows for that agent in window
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import case, desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.core.policies.analytics_policies import (
    HoursSavedPolicy,
    get_hours_saved_policy,
)
from wekala.db.models import Agent, ApiRequestLog


@dataclass(frozen=True)
class KpiSummary:
    invocations: int
    hours_saved: float
    active_agents: int
    p95_latency_ms: int
    tool_calls: int
    vetting_runs_completed: int
    documents_uploaded: int
    range_days: int


@dataclass(frozen=True)
class TimeseriesPoint:
    day: date
    invocations: int
    tool_calls: int
    avg_latency_ms: int


@dataclass(frozen=True)
class AgentLeaderboardRow:
    agent_id: uuid.UUID
    name: str
    invocations: int
    success_rate: float
    p95_latency_ms: int
    hours_saved: float


class AnalyticsService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        hours_saved: HoursSavedPolicy | None = None,
    ) -> None:
        self._db = db
        self._hours_saved = hours_saved or get_hours_saved_policy()

    # ------------------------------------------------------------------
    # KPI summary
    # ------------------------------------------------------------------

    async def kpis(self, *, workspace_id: uuid.UUID, range_days: int = 7) -> KpiSummary:
        since = date.today() - timedelta(days=range_days - 1)

        # One MV scan: SUM the counts and the p95 (which is already aggregated daily).
        # The MAX across days approximates a windowed p95 — fine for an exec-tier KPI;
        # finer breakdowns use the timeseries.
        row = (
            await self._db.execute(
                text(
                    """
                    SELECT
                      COALESCE(SUM(invocations), 0) AS invocations,
                      COALESCE(SUM(tool_calls), 0) AS tool_calls,
                      COALESCE(SUM(vetting_runs_completed), 0) AS vetting_runs_completed,
                      COALESCE(SUM(documents_uploaded), 0) AS documents_uploaded,
                      COALESCE(MAX(p95_latency_ms), 0) AS p95_latency_ms
                    FROM mv_workspace_daily
                    WHERE workspace_id = :wid AND day >= :since
                    """
                ),
                {"wid": str(workspace_id), "since": since},
            )
        ).one()

        # Active agents = agents that were invoked in the window.
        active_agents = (
            await self._db.execute(
                select(func.count(func.distinct(ApiRequestLog.agent_id))).where(
                    ApiRequestLog.workspace_id == workspace_id,
                    ApiRequestLog.agent_id.is_not(None),
                    ApiRequestLog.ts >= since,
                )
            )
        ).scalar_one()

        hours_saved = await self._hours_saved_for_window(
            workspace_id=workspace_id, range_days=range_days
        )

        return KpiSummary(
            invocations=int(row.invocations),
            hours_saved=round(hours_saved, 1),
            active_agents=int(active_agents or 0),
            p95_latency_ms=int(row.p95_latency_ms),
            tool_calls=int(row.tool_calls),
            vetting_runs_completed=int(row.vetting_runs_completed),
            documents_uploaded=int(row.documents_uploaded),
            range_days=range_days,
        )

    # ------------------------------------------------------------------
    # Timeseries (for chart)
    # ------------------------------------------------------------------

    async def timeseries(
        self, *, workspace_id: uuid.UUID, range_days: int = 30
    ) -> list[TimeseriesPoint]:
        since = date.today() - timedelta(days=range_days - 1)
        rows = (
            await self._db.execute(
                text(
                    """
                    SELECT day, invocations, tool_calls, avg_latency_ms
                    FROM mv_workspace_daily
                    WHERE workspace_id = :wid AND day >= :since
                    ORDER BY day ASC
                    """
                ),
                {"wid": str(workspace_id), "since": since},
            )
        ).all()
        return [
            TimeseriesPoint(
                day=r.day,
                invocations=int(r.invocations),
                tool_calls=int(r.tool_calls),
                avg_latency_ms=int(r.avg_latency_ms),
            )
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Top-N agents
    # ------------------------------------------------------------------

    async def top_agents(
        self, *, workspace_id: uuid.UUID, range_days: int = 7, limit: int = 10
    ) -> list[AgentLeaderboardRow]:
        since = datetime.utcnow() - timedelta(days=range_days)
        # Aggregate by agent from api_request_log.
        success_case = case((ApiRequestLog.status_code.between(200, 299), 1), else_=0)
        result = await self._db.execute(
            select(
                ApiRequestLog.agent_id,
                func.count().label("invocations"),
                func.sum(success_case).label("successes"),
                func.percentile_cont(0.95)
                .within_group(ApiRequestLog.latency_ms)
                .label("p95_latency_ms"),
            )
            .where(
                ApiRequestLog.workspace_id == workspace_id,
                ApiRequestLog.agent_id.is_not(None),
                ApiRequestLog.ts >= since,
            )
            .group_by(ApiRequestLog.agent_id)
            .order_by(desc("invocations"))
            .limit(limit)
        )
        rows = list(result.all())
        if not rows:
            return []

        # Resolve agent names in a single query
        agent_ids = [r.agent_id for r in rows]
        agents = await self._db.execute(select(Agent.id, Agent.name).where(Agent.id.in_(agent_ids)))
        name_by_id = {a.id: a.name for a in agents.all()}

        out: list[AgentLeaderboardRow] = []
        for r in rows:
            invocations = int(r.invocations or 0)
            successes = int(r.successes or 0)
            success_rate = (successes / invocations) if invocations else 0.0
            mins = self._hours_saved.minutes_for(
                agent_id=str(r.agent_id), agent_name=name_by_id.get(r.agent_id, "")
            )
            out.append(
                AgentLeaderboardRow(
                    agent_id=r.agent_id,
                    name=name_by_id.get(r.agent_id, "(unknown)"),
                    invocations=invocations,
                    success_rate=round(success_rate, 3),
                    p95_latency_ms=int(r.p95_latency_ms or 0),
                    hours_saved=round(invocations * mins / 60, 1),
                )
            )
        return out

    # ------------------------------------------------------------------
    # Hours-saved (windowed total)
    # ------------------------------------------------------------------

    async def _hours_saved_for_window(self, *, workspace_id: uuid.UUID, range_days: int) -> float:
        since = datetime.utcnow() - timedelta(days=range_days)
        # Get per-agent invocation counts in window
        result = await self._db.execute(
            select(
                ApiRequestLog.agent_id,
                func.count().label("invocations"),
            )
            .where(
                ApiRequestLog.workspace_id == workspace_id,
                ApiRequestLog.agent_id.is_not(None),
                ApiRequestLog.ts >= since,
            )
            .group_by(ApiRequestLog.agent_id)
        )
        rows = list(result.all())
        if not rows:
            return 0.0
        # Resolve names
        agent_ids = [r.agent_id for r in rows]
        agents = await self._db.execute(select(Agent.id, Agent.name).where(Agent.id.in_(agent_ids)))
        name_by_id = {a.id: a.name for a in agents.all()}
        total_minutes = 0
        for r in rows:
            mins = self._hours_saved.minutes_for(
                agent_id=str(r.agent_id), agent_name=name_by_id.get(r.agent_id, "")
            )
            total_minutes += int(r.invocations or 0) * mins
        return total_minutes / 60.0

    # ------------------------------------------------------------------
    # Audit log search (admin only at API layer)
    # ------------------------------------------------------------------

    async def search_audit_log(
        self,
        *,
        workspace_id: uuid.UUID,
        action: str | None = None,
        actor_user_id: uuid.UUID | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[dict[str, Any]], int]:
        from wekala.db.models import AuditLog

        q = select(AuditLog).where(AuditLog.actor_workspace_id == workspace_id)
        if action:
            q = q.where(AuditLog.action == action)
        if actor_user_id:
            q = q.where(AuditLog.actor_user_id == actor_user_id)
        if from_dt:
            q = q.where(AuditLog.timestamp >= from_dt)
        if to_dt:
            q = q.where(AuditLog.timestamp <= to_dt)

        count_q = select(func.count()).select_from(q.subquery())
        total = int((await self._db.execute(count_q)).scalar_one())

        page = max(page, 1)
        size = min(max(size, 1), 200)
        items_q = q.order_by(AuditLog.timestamp.desc()).offset((page - 1) * size).limit(size)
        items = list((await self._db.execute(items_q)).scalars().all())
        return [
            {
                "id": str(a.id),
                "timestamp": a.timestamp.isoformat(),
                "actor_user_id": str(a.actor_user_id) if a.actor_user_id else None,
                "action": a.action,
                "resource_type": a.resource_type,
                "resource_id": str(a.resource_id) if a.resource_id else None,
                "outcome": a.outcome,
                "metadata": a.event_metadata or {},
            }
            for a in items
        ], total
