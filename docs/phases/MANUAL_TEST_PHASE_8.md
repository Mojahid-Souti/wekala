# Phase 8 — Command Center & analytics — Manual test

> Core slice: KPI dashboard, timeseries, top-agents leaderboard, anomaly
> detection (z-score + absolute), audit-log search + CSV export.
> Out of scope (deferred — §10): per-user breakdowns (k-anonymity infra
> exists but no UI), Langfuse drill-down, token-cost tracking, anomaly
> auto-resolve, anomaly Slack/email routing.

---

## 0. Pre-flight

- [ ] `make migrate` shows `0018` applied
- [ ] `make test-phase-8` returns green (10 file checks + 9 unit tests)
- [ ] `docker logs wekala-api --tail 5` shows no `mv_refresh_failed` lines
  (the worker runs every 60s; first refresh is non-CONCURRENT to populate the MV)
- [ ] One-time `make mv-refresh` if the worker hasn't fired yet

## 1. KPI strip

- [ ] Sidebar → **Command Center** loads without errors
- [ ] All five KPI cards render: Invocations, Hours saved, Active agents,
  p95 latency, Tool calls
- [ ] Range chips (7d, 14d, 30d, 90d) switch and refetch
- [ ] Invocations matches `SELECT count(*) FROM api_request_log WHERE workspace_id=… AND ts >= now() - interval '7 days'`

## 2. Hours-saved policy

Edit `infra/policies/hours_saved.yaml` and add a per-agent override:

```yaml
by_agent_id:
  "<some-published-approved-agent-uuid>": 12
```

- [ ] Restart API (`docker compose restart wekala-api`)
- [ ] Hours-saved KPI updates accordingly on next refetch
- [ ] Pattern matches still apply for other agents (e.g. `customer_support_*` → 5 minutes)

## 3. Timeseries chart

- [ ] Daily invocations bar chart renders one bar per day in range
- [ ] Empty range shows "No invocations yet in this range." (not a chart with all-zero bars)
- [ ] Bars scale to the max daily value; today's bar shows the latest count
- [ ] Hover (title tooltip) reveals the exact count

## 4. Top-N agents

> Setup: invoke a published+approved agent via the public API a few times
> with different `Authorization: Bearer wk_…` keys.

- [ ] Top agents table populates with name, invocations, success rate, p95, hours-saved
- [ ] Sorted by invocations DESC; clicking the name navigates to the agent detail page
- [ ] Success rate = invocations with status 2xx / total

## 5. Anomalies — live evaluation

- [ ] With low/no traffic, all three rules show `ok`
- [ ] Inject anomaly: insert a synthetic high invocation count for today via psql:
      ```sql
      -- Simulate a spike for today
      INSERT INTO api_request_log (api_key_id, workspace_id, agent_id, endpoint, status_code, latency_ms, ts)
      SELECT
        (SELECT id FROM api_keys WHERE workspace_id='<wid>' LIMIT 1),
        '<wid>', NULL, 'invoke', 200, 100, now()
      FROM generate_series(1, 500);
      REFRESH MATERIALIZED VIEW mv_workspace_daily;
      ```
- [ ] Visit Command Center → `invocations_spike` rule now fires (red row in the Anomalies section, or persisted alert at the top)
- [ ] `SELECT * FROM anomaly_alerts WHERE workspace_id='<wid>' AND status='open';` shows the row

## 6. Anomaly acknowledge (admin)

- [ ] Click **Acknowledge** on a fired alert
- [ ] Alert disappears from the open list
- [ ] DB row: `status='acknowledged'`, `acknowledged_by=<your-uuid>`, `acknowledged_at IS NOT NULL`
- [ ] Non-admin attempt to call POST `.../anomalies/{id}/acknowledge` → 403

## 7. Audit log search + CSV export

- [ ] Audit log preview at bottom of page shows the most recent 20 entries
- [ ] **Export CSV ↓** opens a downloadable file with one row per audit event
- [ ] First row is a header: `timestamp,actor_user_id,action,resource_type,resource_id,outcome`
- [ ] Subsequent rows match the API's audit log response
- [ ] A new `audit_log` row is written for the export itself with `action='analytics.export'`

## 8. RBAC enforcement (OPA)

> Setup: workspace member with `viewer` role.

- [ ] Viewer can see KPIs, timeseries, top-agents, anomalies list → 200
- [ ] Viewer hits `GET /audit-log` → **403** (admin-only)
- [ ] Viewer hits `GET /exports/audit-log.csv` → **403** (builder+)
- [ ] Viewer hits `POST /anomalies/{id}/acknowledge` → **403**
- [ ] Builder can export CSV; cannot acknowledge anomalies

## 9. Tenant isolation (RLS)

- [ ] User in workspace A cannot see workspace B's KPIs / timeseries / anomalies
- [ ] Direct SQL with their JWT sub: `SELECT * FROM mv_workspace_daily;` returns only their workspace's rows
  - Note: MVs don't auto-inherit RLS — verified via the application path which always filters by `workspace_id`.

## 10. Out of scope (deferred follow-on)

- **Per-user breakdowns** — k-anonymity infra exists, no UI surface
- **Langfuse drill-down link** — Langfuse trace IDs aren't surfaced reliably yet
- **Token-cost USD** — needs LLM gateway integration (cost-per-token table)
- **Anomaly auto-resolve** — currently manual ack only
- **Slack/email anomaly routing** — Phase 7 webhooks could carry this; needs routing rules UI
- **Materialized view for per-agent metrics** — currently raw queries; fast enough for n<1000 agents
- **Hot-reload of YAML policies** — restart required after editing

## 11. Known limits / design choices

- **MV refresh cadence: 60s**. Dashboards can be up to 60s stale.
- **MV first-pass non-CONCURRENT**: Postgres requires the MV to have data before CONCURRENT refresh. The worker handles this transparently on first run.
- **Anomaly evaluation is on-read** (cheap; 7-day baseline window). Persisted only when a threshold is crossed for a given day window — subsequent reads reuse the row.
- **Audit log search uses Postgres**, not Meilisearch. Filter-heavy queries on `(actor_workspace_id, action, timestamp)` are O(log n) via existing Phase 1 indexes.
- **CSV export streams** via async generator — flat memory regardless of row count, capped at 10k rows per request.
