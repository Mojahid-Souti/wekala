import { useMemo, useState } from "react";
import { ReportDetail } from "@/components/ReportDetail";
import { StatusBadge } from "@/components/StatusBadge";
import { useReports } from "@/hooks/useReports";
import { MOCK_AGENTS, MOCK_MEMBERS } from "@/mock/data";

/**
 * Agent reports admin screen (AD3). Master/detail: the queue on the left, the
 * selected report's detail + resolve/dismiss actions on the right. A standalone
 * AD2 list can later drop in this same ReportDetail component.
 */
export function ReportsPage() {
  const { reports, resolve, dismiss } = useReports();
  const [selectedId, setSelectedId] = useState<string | null>(
    reports[0]?.id ?? null,
  );

  // O(1) name lookups so list rows + detail don't rescan the arrays each render.
  const agentNameById = useMemo(
    () => new Map(MOCK_AGENTS.map((agent) => [agent.id, agent.name])),
    [],
  );
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

  const agentName = (id: string) => agentNameById.get(id) ?? id;
  const memberName = (id: string | null) =>
    id ? (memberNameById.get(id) ?? id) : "—";

  const selected = reports.find((report) => report.id === selectedId) ?? null;
  const openCount = reports.filter(
    (report) => report.status === "open" || report.status === "reviewing",
  ).length;

  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="font-semibold text-neutral-900 text-xl tracking-tight">
          Agent reports
        </h1>
        <p className="text-neutral-500 text-sm">
          {openCount} open · {reports.length} total
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 border-dashed bg-white p-10 text-center text-neutral-500 text-sm">
          No reports to review.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {reports.map((report) => {
              const active = report.id === selectedId;
              return (
                <li key={report.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(report.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      active
                        ? "border-neutral-900 bg-white ring-1 ring-neutral-900"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-neutral-800 text-sm">
                        {agentName(report.agent_id)}
                      </span>
                      <StatusBadge status={report.status} />
                    </div>
                    <p className="mt-1 truncate text-neutral-500 text-xs">
                      {report.reason}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <ReportDetail
              key={selected.id}
              report={selected}
              agentName={agentName(selected.agent_id)}
              reporterName={memberName(selected.reporter_id)}
              resolverName={memberName(selected.resolved_by)}
              onResolve={resolve}
              onDismiss={dismiss}
            />
          ) : (
            <div className="rounded-xl border border-neutral-200 border-dashed bg-white p-10 text-center text-neutral-500 text-sm">
              Select a report to view its details.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
