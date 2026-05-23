"""Phase 8 — Command Center & analytics endpoints.

All routes are workspace-scoped via `require_workspace_role`. RLS on the
underlying tables/MVs is the second line of defense.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.auth.base import UserResult
from wekala.api.deps import check_opa, require_workspace_role
from wekala.core.constants import Action, Outcome, ResourceType, Role
from wekala.db.repositories.audit import AuditRepository
from wekala.db.session import get_db
from wekala.services.analytics_service import AnalyticsService
from wekala.services.anomaly_service import AnomalyService

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["analytics"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class KpiOut(BaseModel):
    invocations: int
    hours_saved: float
    active_agents: int
    p95_latency_ms: int
    tool_calls: int
    vetting_runs_completed: int
    documents_uploaded: int
    range_days: int


class TimeseriesPointOut(BaseModel):
    day: str
    invocations: int
    tool_calls: int
    avg_latency_ms: int


class AgentLeaderboardRowOut(BaseModel):
    agent_id: uuid.UUID
    name: str
    invocations: int
    success_rate: float
    p95_latency_ms: int
    hours_saved: float


class AnomalyOut(BaseModel):
    id: uuid.UUID
    metric_name: str
    threshold_kind: str
    threshold_value: float
    observed_value: float
    status: str
    severity: str
    note: str
    window_start: datetime
    window_end: datetime
    created_at: datetime


class AnomalyEvalOut(BaseModel):
    """Live evaluation result; persistent alerts come from /anomalies."""

    rule_id: str
    metric: str
    fired: bool
    observed_value: float
    threshold: float
    z_score: float | None


class AuditLogPage(BaseModel):
    items: list[dict[str, Any]]
    total: int
    page: int
    size: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/analytics/kpis", response_model=KpiOut)
async def get_kpis(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    range_days: int = Query(7, ge=1, le=365),
) -> KpiOut:
    _, role = caller
    if not await check_opa(Action.ANALYTICS_VIEW, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    summary = await AnalyticsService(db).kpis(workspace_id=workspace_id, range_days=range_days)
    return KpiOut(**summary.__dict__)


@router.get("/analytics/timeseries", response_model=list[TimeseriesPointOut])
async def get_timeseries(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    range_days: int = Query(30, ge=7, le=365),
) -> list[TimeseriesPointOut]:
    _, role = caller
    if not await check_opa(Action.ANALYTICS_VIEW, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    points = await AnalyticsService(db).timeseries(workspace_id=workspace_id, range_days=range_days)
    return [
        TimeseriesPointOut(
            day=p.day.isoformat(),
            invocations=p.invocations,
            tool_calls=p.tool_calls,
            avg_latency_ms=p.avg_latency_ms,
        )
        for p in points
    ]


@router.get("/analytics/top-agents", response_model=list[AgentLeaderboardRowOut])
async def get_top_agents(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    range_days: int = Query(7, ge=1, le=365),
    n: int = Query(10, ge=1, le=50),
) -> list[AgentLeaderboardRowOut]:
    _, role = caller
    if not await check_opa(Action.ANALYTICS_VIEW, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    rows = await AnalyticsService(db).top_agents(
        workspace_id=workspace_id, range_days=range_days, limit=n
    )
    return [AgentLeaderboardRowOut(**r.__dict__) for r in rows]


# ----- Anomalies -----


@router.get("/anomalies/evaluate", response_model=list[AnomalyEvalOut])
async def evaluate_anomalies(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AnomalyEvalOut]:
    """Run anomaly rules now and persist any new alerts."""
    _, role = caller
    if not await check_opa(Action.ANALYTICS_VIEW, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    results = await AnomalyService(db).evaluate_and_persist(workspace_id=workspace_id)
    return [
        AnomalyEvalOut(
            rule_id=r.rule.id,
            metric=r.rule.metric,
            fired=r.fired,
            observed_value=r.observed_value,
            threshold=r.rule.threshold,
            z_score=r.z_score,
        )
        for r in results
    ]


@router.get("/anomalies", response_model=list[AnomalyOut])
async def list_anomalies(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.VIEWER))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AnomalyOut]:
    alerts = await AnomalyService(db).list_open(workspace_id)
    return [
        AnomalyOut(
            id=a.id,
            metric_name=a.metric_name,
            threshold_kind=a.threshold_kind,
            threshold_value=float(a.threshold_value),
            observed_value=float(a.observed_value),
            status=a.status,
            severity=str((a.alert_metadata or {}).get("severity", "medium")),
            note=str((a.alert_metadata or {}).get("note", "")),
            window_start=a.window_start,
            window_end=a.window_end,
            created_at=a.created_at,
        )
        for a in alerts
    ]


@router.post("/anomalies/{alert_id}/acknowledge", response_model=AnomalyOut)
async def acknowledge_anomaly(
    workspace_id: uuid.UUID,
    alert_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AnomalyOut:
    user, role = caller
    if not await check_opa(Action.ANOMALY_ACK, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    alert = await AnomalyService(db).acknowledge(
        alert_id=alert_id, workspace_id=workspace_id, actor_id=user.id
    )
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return AnomalyOut(
        id=alert.id,
        metric_name=alert.metric_name,
        threshold_kind=alert.threshold_kind,
        threshold_value=float(alert.threshold_value),
        observed_value=float(alert.observed_value),
        status=alert.status,
        severity=str((alert.alert_metadata or {}).get("severity", "medium")),
        note=str((alert.alert_metadata or {}).get("note", "")),
        window_start=alert.window_start,
        window_end=alert.window_end,
        created_at=alert.created_at,
    )


# ----- Audit log search + export -----


@router.get("/audit-log", response_model=AuditLogPage)
async def search_audit_log(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.ADMIN))],
    db: Annotated[AsyncSession, Depends(get_db)],
    action: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
) -> AuditLogPage:
    items, total = await AnalyticsService(db).search_audit_log(
        workspace_id=workspace_id,
        action=action,
        actor_user_id=actor_user_id,
        from_dt=from_dt,
        to_dt=to_dt,
        page=page,
        size=size,
    )
    return AuditLogPage(items=items, total=total, page=page, size=size)


@router.get("/exports/audit-log.csv")
async def export_audit_log_csv(
    workspace_id: uuid.UUID,
    caller: Annotated[tuple[UserResult, Role], Depends(require_workspace_role(Role.BUILDER))],
    db: Annotated[AsyncSession, Depends(get_db)],
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
) -> StreamingResponse:
    """Streamed CSV export. Audit-logged."""
    user, role = caller
    if not await check_opa(Action.ANALYTICS_EXPORT, role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    items, _ = await AnalyticsService(db).search_audit_log(
        workspace_id=workspace_id,
        from_dt=from_dt,
        to_dt=to_dt,
        page=1,
        size=10000,
    )

    audit = AuditRepository(db)
    await audit.record(
        action=Action.ANALYTICS_EXPORT,
        outcome=Outcome.SUCCESS,
        actor_user_id=user.id,
        actor_workspace_id=workspace_id,
        resource_type=ResourceType.METRIC,
        metadata={"kind": "audit_log_csv", "row_count": len(items)},
    )

    def _stream():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["timestamp", "actor_user_id", "action", "resource_type", "resource_id", "outcome"]
        )
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for row in items:
            writer.writerow(
                [
                    row["timestamp"],
                    row.get("actor_user_id") or "",
                    row["action"],
                    row.get("resource_type") or "",
                    row.get("resource_id") or "",
                    row["outcome"],
                ]
            )
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        _stream(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="audit-log-{workspace_id}-'
                f'{datetime.utcnow().date().isoformat()}.csv"'
            )
        },
    )
