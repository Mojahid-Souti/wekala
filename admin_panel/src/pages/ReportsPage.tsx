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
  open:       "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  reviewing:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  resolved:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  dismissed:  "bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200",
};

const agentName = Object.fromEntries(MOCK_AGENTS.map((a) => [a.id, a.name]));
const memberName = Object.fromEntries(
  MOCK_MEMBERS.map((m) => [m.user_id, m.full_name ?? m.email ?? m.user_id])
);

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ReportsPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const rows =
    filter === "all"
      ? MOCK_REPORTS
      : MOCK_REPORTS.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">

      {/* Status filter bar */}
      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1">
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={
                active
                  ? "rounded-lg px-3 py-1.5 text-sm font-medium bg-neutral-900 text-white"
                  : "rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="font-medium text-neutral-700 text-sm">No reports</p>
          <p className="mt-1 text-neutral-500 text-sm">
            There are no{filter !== "all" ? ` ${filter}` : ""} reports to show.
          </p>
        </div>
      ) : (

        /* Reports table */
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-neutral-100 border-b">
                <th className="px-4 py-3 text-start font-medium text-neutral-500 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-start font-medium text-neutral-500">Agent</th>
                <th className="px-4 py-3 text-start font-medium text-neutral-500 whitespace-nowrap">Reporter</th>
                <th className="px-4 py-3 text-start font-medium text-neutral-500">Reason</th>
                <th className="px-4 py-3 text-start font-medium text-neutral-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((report) => (
                <tr key={report.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                    {fmtDate(report.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900 whitespace-nowrap">
                    {agentName[report.agent_id] ?? report.agent_id}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                    {memberName[report.reporter_id] ?? report.reporter_id}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 max-w-xs">
                    {report.reason}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[report.status]}`}>
                      {report.status}
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
