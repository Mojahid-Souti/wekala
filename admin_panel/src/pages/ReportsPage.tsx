import { useState } from "react";
import { MOCK_AGENTS, MOCK_MEMBERS, MOCK_REPORTS } from "@/mock/data";
import type { AgentReport } from "@/types/api";

type StatusFilter = AgentReport["status"] | "all";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const STATUS_BADGE: Record<AgentReport["status"], string> = {
  open: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  reviewing: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  dismissed: "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
};

// Build lookup maps once — O(n) here, O(1) per render.
const agentName = Object.fromEntries(MOCK_AGENTS.map((a) => [a.id, a.name]));
const memberName = Object.fromEntries(
  MOCK_MEMBERS.map((m) => [m.user_id, m.full_name ?? m.email ?? m.user_id])
);

export function ReportsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const rows =
    filter === "all" ? MOCK_REPORTS : MOCK_REPORTS.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Reports</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{MOCK_REPORTS.length} total</p>
      </div>

      {/* Status filter bar
          flex-wrap lets chips wrap to a new line on narrow viewports.
          In RTL the flex main axis is inline (right-to-left), so chips
          naturally flow from the inline-start side. */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-8 py-16 text-center">
          <p className="text-sm font-medium text-neutral-500">No reports match this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 text-start font-medium">Date</th>
                <th className="px-4 py-3 text-start font-medium">Agent</th>
                <th className="px-4 py-3 text-start font-medium">Reporter</th>
                <th className="px-4 py-3 text-start font-medium">Reason</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((report) => (
                <tr key={report.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-500">
                    {new Date(report.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {agentName[report.agent_id] ?? report.agent_id}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {memberName[report.reporter_id] ?? report.reporter_id}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-neutral-600">{report.reason}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[report.status]}`}
                    >
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
