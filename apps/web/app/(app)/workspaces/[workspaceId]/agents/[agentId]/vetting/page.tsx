"use client";

import { SeverityBadge, VettingStatusBadge } from "@/components/vetting/vetting-status-badge";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const POLL_MS = 2000; // status polling cadence while scanning

export default function VettingPage() {
  const { workspaceId, agentId } = useParams<{ workspaceId: string; agentId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: agent } = useQuery({
    queryKey: ["agent", workspaceId, agentId],
    queryFn: () => api.agents.get(workspaceId, agentId, token),
    enabled: !!token,
  });

  const { data: runs } = useQuery({
    queryKey: ["vetting-runs", agentId],
    queryFn: () => api.vetting.listRuns(workspaceId, agentId, token),
    enabled: !!token,
    refetchInterval: (q) => {
      const data = q.state.data as { status: string }[] | undefined;
      const scanning = data?.some((r) => r.status === "scanning");
      return scanning ? POLL_MS : false;
    },
  });

  const latest = runs?.[0];

  const { data: findings } = useQuery({
    queryKey: ["vetting-findings", latest?.id],
    queryFn: () =>
      latest
        ? api.vetting.listFindings(workspaceId, agentId, latest.id, token)
        : Promise.resolve([]),
    enabled: !!token && !!latest && latest.status === "completed",
  });

  const submit = useMutation({
    mutationFn: () => api.vetting.submit(workspaceId, agentId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetting-runs", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      toast("Submitted for review. Scanning…", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Submit failed", "error"),
  });

  const approve = useMutation({
    mutationFn: () =>
      latest ? api.vetting.approve(workspaceId, agentId, latest.id, note, token) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetting-runs", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      setNote("");
      toast("Agent approved.", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Approve failed", "error"),
  });

  const reject = useMutation({
    mutationFn: () =>
      latest ? api.vetting.reject(workspaceId, agentId, latest.id, note, token) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetting-runs", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      setNote("");
      toast("Agent rejected. Status reverted to Draft.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Reject failed", "error"),
  });

  const canSubmit =
    agent?.status === "draft" ||
    agent?.vetting_status === "unvetted" ||
    agent?.vetting_status === "failed";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={ROUTES.agentDetail(workspaceId, agentId)}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to agent
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Vetting</h1>
          <p className="mt-1 text-sm text-gray-500">
            Safety review — PII detection and prompt-injection scanning.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {agent && <VettingStatusBadge status={agent.vetting_status} />}
          {canSubmit && (
            <button
              type="button"
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </div>

      {/* Latest run summary */}
      {latest && (
        <section className="rounded-lg border bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Latest run</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>
                Status: <strong className="text-gray-700">{latest.status}</strong>
              </span>
              {latest.outcome && (
                <span>
                  · Outcome:{" "}
                  <strong className="text-gray-700">{latest.outcome.replace(/_/g, " ")}</strong>
                </span>
              )}
              <span>
                · Classification: <strong className="text-gray-700">{latest.classification}</strong>
              </span>
            </div>
          </div>

          {latest.status === "scanning" && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Scanning in progress… this page auto-refreshes.
            </div>
          )}

          {latest.status === "completed" && latest.finding_summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <SummaryStat label="Total" value={latest.finding_summary.total ?? 0} />
              <SummaryStat
                label="Critical"
                value={latest.finding_summary.by_severity?.critical ?? 0}
                tone={(latest.finding_summary.by_severity?.critical ?? 0) > 0 ? "red" : "gray"}
              />
              <SummaryStat
                label="High"
                value={latest.finding_summary.by_severity?.high ?? 0}
                tone={(latest.finding_summary.by_severity?.high ?? 0) > 0 ? "red" : "gray"}
              />
              <SummaryStat label="Medium" value={latest.finding_summary.by_severity?.medium ?? 0} />
              <SummaryStat label="Low" value={latest.finding_summary.by_severity?.low ?? 0} />
            </div>
          )}

          {/* Reviewer decision panel */}
          {latest.status === "completed" &&
            latest.outcome === "ready_for_review" &&
            (() => {
              const criticalCount = latest.finding_summary?.by_severity?.critical ?? 0;
              const blocked = criticalCount > 0;
              return (
                <div
                  className={`rounded-lg border p-4 space-y-3 ${
                    blocked ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
                  }`}
                >
                  {blocked ? (
                    <p className="text-sm text-red-900">
                      <strong>Approval blocked.</strong> This run has {criticalCount} critical
                      finding{criticalCount === 1 ? "" : "s"} that cannot be approved away. Edit the
                      agent to remove these findings and resubmit. Or reject to send the agent back
                      to Draft.
                    </p>
                  ) : (
                    <p className="text-sm text-blue-900">
                      This run is awaiting your decision. Approve to allow publishing; reject to
                      send the agent back to Draft.
                    </p>
                  )}
                  <textarea
                    rows={2}
                    placeholder="Optional note for the audit log"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    {!blocked && (
                      <button
                        type="button"
                        onClick={() => approve.mutate()}
                        disabled={approve.isPending}
                        className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {approve.isPending ? "Approving…" : "Approve"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => reject.mutate()}
                      disabled={reject.isPending}
                      className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {reject.isPending ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                </div>
              );
            })()}

          {latest.approval_decision && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2 border">
              Reviewer decision:{" "}
              <strong className="text-gray-900">{latest.approval_decision}</strong>
              {latest.approval_note && (
                <span className="ml-1">— &ldquo;{latest.approval_note}&rdquo;</span>
              )}
            </div>
          )}
        </section>
      )}

      {/* Findings */}
      {findings && findings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">Findings ({findings.length})</h2>
          <div className="rounded-lg border bg-white divide-y overflow-hidden">
            {findings.map((f) => (
              <div key={f.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={f.severity} />
                      <span className="font-mono text-xs text-gray-700">{f.finding_type}</span>
                      <span className="text-xs text-gray-400">· {f.location}</span>
                    </div>
                    {f.matched_full ? (
                      <p className="text-sm text-gray-700">
                        <span className="font-mono text-xs">{f.matched_full}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        <span className="font-mono text-xs">{f.matched_preview}</span>
                        <span className="ml-2 text-gray-400">
                          (redacted — admin role required for full text)
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {runs && runs.length > 1 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900">History</h2>
          <div className="rounded-lg border bg-white divide-y overflow-hidden">
            {runs.slice(1).map((r) => (
              <div key={r.id} className="px-4 py-2 text-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{new Date(r.started_at).toLocaleString()}</span>
                  <span className="text-gray-700">{r.outcome ?? r.status}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {r.finding_summary?.total ?? 0} findings
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!runs && <p className="text-sm text-gray-500">Loading…</p>}
      {runs && runs.length === 0 && (
        <p className="text-sm text-gray-500">
          This agent has never been vetted. Click &ldquo;Submit for review&rdquo; to start.
        </p>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "red";
}) {
  const colorClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-gray-200 bg-white text-gray-900";
  return (
    <div className={`rounded-md border px-3 py-2 ${colorClass}`}>
      <p className="text-xs uppercase tracking-wide font-medium opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}
