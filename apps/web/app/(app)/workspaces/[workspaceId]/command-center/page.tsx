"use client";

import { ActivityChart, ChartLegend } from "@/components/analytics/activity-chart";
import { InvocationsPie } from "@/components/analytics/activity-pie";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bot,
  ChevronDown,
  Clock,
  Coins,
  Download,
  Gauge,
  PieChart,
  ScrollText,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useState } from "react";

const RANGE_OPTIONS = [7, 14, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

// Monochrome theme: every tone resolves to the same neutral chip. The `tone`
// prop is kept as a theming seam so accent colors can be reintroduced in one place.
type Tone = "blue" | "orange" | "neutral";
const TONE_CHIP: Record<Tone, string> = {
  blue: "bg-neutral-100 text-neutral-700",
  orange: "bg-neutral-100 text-neutral-700",
  neutral: "bg-neutral-100 text-neutral-700",
};

export default function CommandCenterPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeDays>(7);
  const [showAudit, setShowAudit] = useState(false);

  const { data: kpis } = useQuery({
    queryKey: ["analytics-kpis", workspaceId, range],
    queryFn: () => api.analytics.kpis(workspaceId, range, token),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const { data: cost } = useQuery({
    queryKey: ["analytics-compute-cost", workspaceId, range],
    queryFn: () => api.analytics.computeCost(workspaceId, range, token),
    enabled: !!token,
    refetchInterval: 60_000,
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

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-5 py-6 lg:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Command Center</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Workspace activity, cost, top agents, anomalies, and audit history.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setRange(d)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                range === d
                  ? "bg-neutral-950 text-white shadow-sm"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={Activity}
          tone="blue"
          label="Invocations"
          value={kpis?.invocations ?? 0}
          subtitle={`last ${range}d`}
        />
        <KpiCard
          icon={Clock}
          tone="orange"
          label="Hours saved"
          value={kpis ? kpis.hours_saved.toFixed(1) : "0.0"}
          subtitle="estimated"
        />
        <KpiCard
          icon={Bot}
          tone="blue"
          label="Active agents"
          value={kpis?.active_agents ?? 0}
          subtitle={`last ${range}d`}
        />
        <KpiCard
          icon={Gauge}
          tone="neutral"
          label="p95 latency"
          value={`${kpis?.p95_latency_ms ?? 0}`}
          unit="ms"
        />
        <KpiCard
          icon={Wrench}
          tone="orange"
          label="Tool calls"
          value={kpis?.tool_calls ?? 0}
          subtitle={`last ${range}d`}
        />
      </section>

      {/* Compute cost & ROI */}
      <Panel
        icon={Coins}
        tone="orange"
        title="Compute cost & ROI"
        action={<span className="text-xs text-neutral-400">local inference · last {range}d</span>}
      >
        <p className="-mt-1 mb-4 max-w-2xl text-xs text-neutral-500">
          Local models charge no per-token fee — the real cost is amortized hardware + electricity.
          Cost per token falls as the GPU is used more.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <CostStat
            label="Tokens processed"
            value={cost ? cost.total_tokens.toLocaleString() : "—"}
            sub={`${cost?.runs ?? 0} runs`}
          />
          <CostStat
            label="$ / 1M (at throughput)"
            value={cost ? `$${cost.marginal_usd_per_1m.toFixed(2)}` : "—"}
            sub="marginal floor"
          />
          <CostStat
            label="GPU utilization"
            value={cost ? `${cost.utilization_pct.toFixed(2)}%` : "—"}
            sub="active / calendar"
          />
          <CostStat
            label="Compute cost"
            value={cost ? `$${cost.compute_cost_usd.toFixed(2)}` : "—"}
            sub={`amortized ${range}d`}
          />
        </div>
        {cost && cost.total_tokens > 0 && (
          <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
            Effective cost ≈{" "}
            <span className="font-semibold text-neutral-900">
              ${cost.effective_usd_per_1m.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              /1M
            </span>{" "}
            at {cost.utilization_pct.toFixed(2)}% utilization — dominated by idle hardware. It falls
            toward the ${cost.marginal_usd_per_1m.toFixed(2)}/1M floor as usage grows.{" "}
            {cost.savings_vs_cloud_usd >= 0
              ? `That's $${cost.savings_vs_cloud_usd.toFixed(2)} cheaper than ${cost.cloud_reference_name} for this volume.`
              : `${cost.cloud_reference_name} would bill only $${cost.cloud_equivalent_usd.toFixed(4)} for this volume — local wins at scale and keeps data on-prem (PDPL).`}
          </p>
        )}
      </Panel>

      {/* Daily activity (bar) + invocations by agent (pie) */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          icon={BarChart3}
          title="Daily activity"
          action={<ChartLegend />}
          className="lg:col-span-2"
        >
          <ActivityChart data={series ?? []} />
        </Panel>
        <Panel icon={PieChart} title="Invocations by agent">
          <InvocationsPie agents={topAgents ?? []} />
        </Panel>
      </div>

      {/* Top agents (wide) + anomalies (narrow) */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          icon={TrendingUp}
          tone="blue"
          title={`Top agents · last ${range}d`}
          className="lg:col-span-2"
        >
          {topAgents && topAgents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="py-2 text-left font-medium">Agent</th>
                    <th className="py-2 text-right font-medium">Invocations</th>
                    <th className="py-2 text-right font-medium">Success</th>
                    <th className="py-2 text-right font-medium">p95</th>
                    <th className="py-2 text-right font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {topAgents.map((a) => (
                    <tr key={a.agent_id} className="transition-colors hover:bg-neutral-50">
                      <td className="py-2.5">
                        <Link
                          href={ROUTES.agentDetail(workspaceId, a.agent_id)}
                          className="font-medium text-neutral-900 hover:underline"
                        >
                          {a.name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs tabular-nums text-neutral-600">
                        {a.invocations}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs tabular-nums text-neutral-600">
                        {(a.success_rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs tabular-nums text-neutral-600">
                        {a.p95_latency_ms}ms
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs tabular-nums text-neutral-600">
                        {a.hours_saved.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyHint>
              No agent invocations yet. Once agents are invoked via the API, they&apos;ll appear
              here.
            </EmptyHint>
          )}
        </Panel>

        <Panel icon={TriangleAlert} tone="orange" title="Anomalies">
          {openAnomalies && openAnomalies.length > 0 ? (
            <div className="space-y-2">
              {openAnomalies.map((a) => (
                <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-900">{a.metric_name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-red-700">
                    {a.threshold_kind} &gt; {a.threshold_value} · observed {a.observed_value}
                  </p>
                  {a.note && <p className="mt-1 text-xs text-red-800">{a.note}</p>}
                  <button
                    type="button"
                    onClick={() => ackMutation.mutate(a.id)}
                    disabled={ackMutation.isPending}
                    className="mt-2 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
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
                  className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 text-sm last:border-0"
                >
                  <span className="truncate font-mono text-xs text-neutral-700">{e.metric}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      e.fired ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-500"
                    )}
                  >
                    {e.fired ? "ALERT" : "ok"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint>No anomaly rules configured.</EmptyHint>
          )}
        </Panel>
      </div>

      {/* Audit log — hidden behind a toggle */}
      <section className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowAudit((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
              <ScrollText className="size-4" />
            </span>
            <h2 className="text-sm font-semibold text-neutral-900">Recent audit log</h2>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500">
              {audit?.total ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span className="hidden sm:inline">{showAudit ? "Hide" : "Show"}</span>
            <ChevronDown className={cn("size-4 transition-transform", showAudit && "rotate-180")} />
          </div>
        </button>
        {showAudit && (
          <div className="border-t border-neutral-100 px-5 pb-5 pt-4">
            <div className="mb-3 flex justify-end">
              <a
                href={`/v1/workspaces/${workspaceId}/exports/audit-log.csv`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                <Download className="size-3.5" />
                Export CSV
              </a>
            </div>
            {audit && audit.items.length > 0 ? (
              <div className="max-h-96 divide-y divide-neutral-100 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 text-xs">
                {audit.items.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-3 px-3 py-2 font-mono"
                  >
                    <span className="tabular-nums text-neutral-400">
                      {row.timestamp.slice(0, 19)}
                    </span>
                    <span className="truncate text-neutral-900">{row.action}</span>
                    <span
                      className={row.outcome === "success" ? "text-neutral-500" : "text-red-600"}
                    >
                      {row.outcome}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint>No audit events yet.</EmptyHint>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Panel({
  icon: Icon,
  tone = "neutral",
  title,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm", className)}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-lg",
                TONE_CHIP[tone]
              )}
            >
              <Icon className="size-4" />
            </span>
          )}
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  subtitle,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-lg",
            TONE_CHIP[tone]
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-neutral-500">{unit}</span>}
      </p>
      {subtitle && <p className="mt-0.5 text-xs text-neutral-400">{subtitle}</p>}
    </div>
  );
}

function CostStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">{value}</p>
      {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-neutral-400">{children}</p>;
}
