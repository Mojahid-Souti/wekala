"use client";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const RANGE_OPTIONS = [7, 14, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

export default function CommandCenterPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeDays>(7);

  const { data: kpis } = useQuery({
    queryKey: ["analytics-kpis", workspaceId, range],
    queryFn: () => api.analytics.kpis(workspaceId, range, token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: series } = useQuery({
    queryKey: ["analytics-timeseries", workspaceId, range],
    queryFn: () => api.analytics.timeseries(workspaceId, Math.max(range, 7), token),
    enabled: !!token,
  });

  const { data: topAgents } = useQuery({
    queryKey: ["analytics-top-agents", workspaceId, range],
    queryFn: () => api.analytics.topAgents(workspaceId, range, 10, token),
    enabled: !!token,
  });

  // Live anomaly evaluation + persisted open alerts
  const { data: anomalyEvals } = useQuery({
    queryKey: ["analytics-anomalies-eval", workspaceId],
    queryFn: () => api.analytics.evaluateAnomalies(workspaceId, token),
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const { data: openAnomalies } = useQuery({
    queryKey: ["analytics-anomalies-open", workspaceId],
    queryFn: () => api.analytics.listAnomalies(workspaceId, token),
    enabled: !!token,
    refetchInterval: 60_000,
  });
  const ackMutation = useMutation({
    mutationFn: (id: string) => api.analytics.acknowledgeAnomaly(workspaceId, id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analytics-anomalies-open", workspaceId] });
      toast("Alert acknowledged.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Failed", "error"),
  });

  const { data: audit } = useQuery({
    queryKey: ["audit-log", workspaceId],
    queryFn: () => api.analytics.auditLog(workspaceId, { page: 1, size: 20 }, token),
    enabled: !!token,
  });

  const maxInvocations = Math.max(1, ...(series?.map((s) => s.invocations) ?? []));

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Command Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Workspace activity, top agents, anomalies, and audit history.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-1">
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRange(d)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                range === d ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Invocations" value={kpis?.invocations ?? 0} subtitle={`last ${range}d`} />
        <KpiCard
          label="Hours saved"
          value={kpis ? kpis.hours_saved.toFixed(1) : "0.0"}
          subtitle="estimated"
        />
        <KpiCard
          label="Active agents"
          value={kpis?.active_agents ?? 0}
          subtitle={`last ${range}d`}
        />
        <KpiCard label="p95 latency" value={`${kpis?.p95_latency_ms ?? 0}`} unit="ms" />
        <KpiCard label="Tool calls" value={kpis?.tool_calls ?? 0} subtitle={`last ${range}d`} />
      </section>

      {/* Timeseries (custom inline bar chart, no Recharts dep yet) */}
      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Daily invocations</h2>
        {series && series.length > 0 ? (
          <div className="flex h-32 items-end gap-1">
            {series.map((p) => {
              const height = (p.invocations / maxInvocations) * 100;
              return (
                <div
                  key={p.day}
                  className="flex-1 min-w-0 flex flex-col items-center gap-1"
                  title={`${p.day} — ${p.invocations} invocations`}
                >
                  <div
                    className="w-full rounded-sm bg-indigo-500 transition-all"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <span className="text-[10px] font-mono text-gray-400 truncate w-full text-center">
                    {p.day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">
            No invocations yet in this range.
          </p>
        )}
      </section>

      {/* Anomalies */}
      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Anomalies</h2>
        {openAnomalies && openAnomalies.length > 0 ? (
          <div className="space-y-2">
            {openAnomalies.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between rounded-md border border-red-200 bg-red-50 p-3 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-900">
                    {a.metric_name}{" "}
                    <span className="text-xs font-mono text-red-700">
                      ({a.threshold_kind} &gt; {a.threshold_value} — observed {a.observed_value})
                    </span>
                  </p>
                  {a.note && <p className="mt-0.5 text-xs text-red-800">{a.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => ackMutation.mutate(a.id)}
                  disabled={ackMutation.isPending}
                  className="shrink-0 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        ) : anomalyEvals && anomalyEvals.length > 0 ? (
          <div className="space-y-1">
            {anomalyEvals.map((e) => (
              <div
                key={e.rule_id}
                className="flex items-center justify-between text-sm border-b last:border-0 border-gray-100 py-1.5"
              >
                <span className="text-gray-700 font-mono text-xs">{e.metric}</span>
                <span className="text-xs text-gray-500">
                  observed {e.observed_value} {e.z_score !== null && `(z=${e.z_score.toFixed(2)})`}
                </span>
                <span
                  className={`text-xs font-medium ${e.fired ? "text-red-700" : "text-green-700"}`}
                >
                  {e.fired ? "ALERT" : "ok"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No anomaly rules configured.</p>
        )}
      </section>

      {/* Top agents */}
      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Top agents (last {range}d)</h2>
        {topAgents && topAgents.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500 tracking-wide">
              <tr>
                <th className="text-left py-2">Agent</th>
                <th className="text-right py-2">Invocations</th>
                <th className="text-right py-2">Success</th>
                <th className="text-right py-2">p95</th>
                <th className="text-right py-2">Hours saved</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topAgents.map((a) => (
                <tr key={a.agent_id}>
                  <td className="py-2">
                    <Link
                      href={ROUTES.agentDetail(workspaceId, a.agent_id)}
                      className="text-indigo-600 hover:underline"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="text-right py-2 font-mono text-xs">{a.invocations}</td>
                  <td className="text-right py-2 font-mono text-xs">
                    {(a.success_rate * 100).toFixed(1)}%
                  </td>
                  <td className="text-right py-2 font-mono text-xs">{a.p95_latency_ms}ms</td>
                  <td className="text-right py-2 font-mono text-xs">{a.hours_saved.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">
            No agent invocations yet. Once you start invoking agents via the public API,
            they&apos;ll appear here.
          </p>
        )}
      </section>

      {/* Audit log preview */}
      <section className="rounded-lg border bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Recent audit log ({audit?.total ?? 0} total)
          </h2>
          <a
            href={`/v1/workspaces/${workspaceId}/exports/audit-log.csv`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-indigo-600 hover:underline"
          >
            Export CSV ↓
          </a>
        </div>
        {audit && audit.items.length > 0 ? (
          <div className="rounded-md border bg-gray-50 divide-y text-xs max-h-96 overflow-auto">
            {audit.items.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 font-mono"
              >
                <span className="text-gray-500">{row.timestamp.slice(0, 19)}</span>
                <span className="text-gray-900 truncate">{row.action}</span>
                <span className={row.outcome === "success" ? "text-green-700" : "text-red-700"}>
                  {row.outcome}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No audit events yet.</p>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  subtitle,
}: {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs uppercase tracking-wide font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-gray-500">{unit}</span>}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
