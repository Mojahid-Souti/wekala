import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import { MOCK_AUDIT, MOCK_KPIS, MOCK_MEMBERS, MOCK_REPORTS } from "@/mock/data";
import { formatDateTime } from "@/utils/format";

const RECENT_ACTIVITY_LIMIT = 5;
const OPEN_REPORT_STATUSES = new Set(["open", "reviewing"]);

/**
 * Admin home (AD6): at-a-glance summary cards (open reports, members, events,
 * active agents) plus a recent-activity feed. Counts are O(n) over the mock
 * collections; the live version reads the same shapes from the dashboard/
 * audit endpoints, so the aggregation logic ports unchanged.
 */
export function DashboardPage() {
  const memberNameById = useMemo(
    () =>
      new Map(
        MOCK_MEMBERS.map((member) => [
          member.user_id,
          member.full_name || member.email || member.user_id,
        ]),
      ),
    [],
  );
  const actorName = (id: string | null) =>
    id ? (memberNameById.get(id) ?? id) : "System";

  const openReports = useMemo(
    () => MOCK_REPORTS.filter((report) => OPEN_REPORT_STATUSES.has(report.status)).length,
    [],
  );

  const recentActivity = useMemo(
    () =>
      [...MOCK_AUDIT]
        .sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, RECENT_ACTIVITY_LIMIT),
    [],
  );

  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-semibold text-neutral-900 text-xl tracking-tight">Dashboard</h1>
        <p className="text-neutral-500 text-sm">Workspace activity at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open reports"
          value={openReports}
          hint={openReports === 1 ? "needs review" : "need review"}
          accent="warning"
        />
        <StatCard label="Members" value={MOCK_MEMBERS.length} hint="in this workspace" />
        <StatCard label="Audit events" value={MOCK_AUDIT.length} hint="recorded actions" />
        <StatCard
          label="Active agents"
          value={MOCK_KPIS.active_agents}
          hint={`last ${MOCK_KPIS.range_days} days`}
        />
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-base text-neutral-800">Recent activity</h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {recentActivity.length === 0 ? (
            <p className="px-5 py-8 text-center text-neutral-500 text-sm">No recent activity.</p>
          ) : (
            <ul>
              {recentActivity.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-4 border-neutral-100 border-b px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-neutral-800 text-sm">
                      <span className="font-medium">{actorName(event.actor_user_id)}</span>{" "}
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 text-xs">
                        {event.action}
                      </code>
                    </p>
                    <p className="mt-0.5 text-neutral-400 text-xs">
                      {formatDateTime(event.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${
                      event.outcome === "success"
                        ? "bg-green-100 text-green-800"
                        : event.outcome === "failure"
                          ? "bg-red-100 text-red-700"
                          : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {event.outcome}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
