import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { isActionable } from "@/hooks/useReports";
import type { AgentReport } from "@/types/api";
import { formatDateTime } from "@/utils/format";

type PendingAction = "resolve" | "dismiss" | null;

type ReportDetailProps = {
  report: AgentReport;
  agentName: string;
  reporterName: string;
  resolverName: string;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-400 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-neutral-800 text-sm">{value}</dd>
    </div>
  );
}

/**
 * Read one report and act on it. Resolve/Dismiss are guarded by an inline
 * confirmation step (they're meaningful, semi-permanent decisions). Once a
 * report is closed the actions are replaced by a read-only resolution summary.
 * The parent remounts this via key={report.id}, so the local pending state
 * resets cleanly when a different report is selected.
 */
export function ReportDetail({
  report,
  agentName,
  reporterName,
  resolverName,
  onResolve,
  onDismiss,
}: ReportDetailProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const actionable = isActionable(report.status);

  function confirmPending() {
    if (pending === "resolve") onResolve(report.id);
    else if (pending === "dismiss") onDismiss(report.id);
    setPending(null);
  }

  return (
    <article className="rounded-xl border border-neutral-200 bg-white">
      <header className="flex items-start justify-between gap-4 border-neutral-100 border-b px-6 py-4">
        <div>
          <h2 className="font-semibold text-base text-neutral-900">{agentName}</h2>
          <p className="text-neutral-400 text-xs">Report {report.id}</p>
        </div>
        <StatusBadge status={report.status} />
      </header>

      <div className="space-y-6 px-6 py-5">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Reported by" value={reporterName} />
          <Field label="Workspace" value={report.workspace_id} />
          <Field label="Agent ID" value={report.agent_id} />
          <Field label="Created" value={formatDateTime(report.created_at)} />
        </dl>

        <div>
          <dt className="text-neutral-400 text-xs uppercase tracking-wide">Reason</dt>
          <p className="mt-1 rounded-lg bg-neutral-50 px-4 py-3 text-neutral-700 text-sm leading-relaxed">
            {report.reason}
          </p>
        </div>

        {!actionable && (
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm">
            <p className="text-neutral-600">
              {report.status === "resolved" ? "Resolved" : "Dismissed"} by{" "}
              <span className="font-medium text-neutral-800">{resolverName}</span> on{" "}
              {formatDateTime(report.resolved_at)}.
            </p>
          </div>
        )}
      </div>

      {actionable && (
        <footer className="border-neutral-100 border-t px-6 py-4">
          {pending ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-neutral-600 text-sm">
                {pending === "resolve" ? "Mark this report resolved?" : "Dismiss this report?"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-600 text-sm hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPending}
                  className={`rounded-lg px-3 py-1.5 font-medium text-sm text-white ${
                    pending === "resolve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-neutral-700 hover:bg-neutral-800"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending("dismiss")}
                className="rounded-lg border border-neutral-200 px-4 py-1.5 font-medium text-neutral-700 text-sm hover:bg-neutral-50"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => setPending("resolve")}
                className="rounded-lg bg-green-600 px-4 py-1.5 font-medium text-sm text-white hover:bg-green-700"
              >
                Resolve
              </button>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
