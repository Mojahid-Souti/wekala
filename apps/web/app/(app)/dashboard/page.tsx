"use client";

export const dynamic = "force-dynamic";

import { useWorkspaces } from "@/components/app/workspace-context";
import { type AgentOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  Hourglass,
  Plus,
  Sparkles,
  Store,
  TriangleAlert,
  UserPlus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Me = { id: string; email: string };

export default function HomePage() {
  const token = useToken();
  const { current: workspace } = useWorkspaces();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.auth
      .me(token)
      .then((data) => {
        if (!cancelled) setMe(data as Me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const wsId = workspace?.id ?? "";
  const enabled = !!token && !!wsId;

  const { data: kpis } = useQuery({
    queryKey: ["home-kpis", wsId],
    queryFn: () => api.analytics.kpis(wsId, 7, token),
    enabled,
  });

  const { data: agentsPage } = useQuery({
    queryKey: ["home-agents", wsId],
    queryFn: () => api.agents.list(wsId, token),
    enabled,
  });

  const { data: auditLog } = useQuery({
    queryKey: ["home-audit", wsId],
    queryFn: () => api.analytics.auditLog(wsId, { page: 1, size: 5 }, token),
    enabled,
  });

  const agents = agentsPage?.items ?? [];
  const hasAgents = agents.length > 0;
  const showKpis = !!kpis && (kpis.invocations > 0 || kpis.active_agents > 0);
  const hasActivity = (auditLog?.items.length ?? 0) > 0;

  const displayName = me?.email.split("@")[0] ?? "there";
  const greeting = getGreeting();
  const isFirstTime = !hasAgents && !hasActivity;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-5 py-6 lg:px-7">
      <Greeting name={displayName} greeting={greeting} firstTime={isFirstTime} />

      {showKpis && kpis && (
        <KpiStrip
          invocations={kpis.invocations}
          hoursSaved={kpis.hours_saved}
          activeAgents={kpis.active_agents}
          p95={kpis.p95_latency_ms}
        />
      )}

      <GetStarted workspaceId={wsId} firstTime={isFirstTime} />

      <div className="grid gap-6 lg:grid-cols-2">
        <YourAgents agents={agents} workspaceId={wsId} />
        <RecentActivity items={auditLog?.items ?? []} workspaceId={wsId} />
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Greeting({
  name,
  greeting,
  firstTime,
}: {
  name: string;
  greeting: string;
  firstTime: boolean;
}) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <header className="space-y-1.5">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
        {greeting}, {name}
      </h1>
      <p className="text-sm text-neutral-500">
        {firstTime ? "Welcome to Wekala. Let's get you set up." : today}
      </p>
    </header>
  );
}

function KpiStrip({
  invocations,
  hoursSaved,
  activeAgents,
  p95,
}: {
  invocations: number;
  hoursSaved: number;
  activeAgents: number;
  p95: number;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Activity (last 7 days)
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={<Zap className="size-4" />}
          label="Invocations"
          value={invocations.toLocaleString()}
        />
        <KpiTile
          icon={<Hourglass className="size-4" />}
          label="Hours saved"
          value={hoursSaved.toFixed(1)}
        />
        <KpiTile
          icon={<Sparkles className="size-4" />}
          label="Active agents"
          value={String(activeAgents)}
        />
        <KpiTile icon={<Clock className="size-4" />} label="p95 latency" value={`${p95} ms`} />
      </div>
    </section>
  );
}

function KpiTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="mt-0.5 text-2xl font-semibold text-neutral-950">{value}</div>
      </div>
    </div>
  );
}

function GetStarted({
  workspaceId,
  firstTime,
}: {
  workspaceId: string;
  firstTime: boolean;
}) {
  const newAgentHref = workspaceId ? ROUTES.newAgent(workspaceId) : "#";
  const kbHref = workspaceId ? ROUTES.knowledgeBase(workspaceId) : "#";

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-950">
          {firstTime ? "Get started" : "Quick actions"}
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ActionCard
          icon={<Sparkles className="size-4" />}
          title={firstTime ? "Create your first agent" : "Create new agent"}
          description="Import a YAML, pick a template, or chat to build one."
          ctaLabel="Create agent"
          href={newAgentHref}
          tour="quick-agent"
        />
        <ActionCard
          icon={<Store className="size-4" />}
          title="Browse the Bazaar"
          description="Discover pre-vetted agents your team can hire."
          ctaLabel="Open Bazaar"
          href={ROUTES.bazaar}
          tour="quick-bazaar"
        />
        <ActionCard
          icon={<BookOpen className="size-4" />}
          title="Upload knowledge"
          description="Ground your agents in your team's documents."
          ctaLabel="Upload docs"
          href={kbHref}
          tour="quick-kb"
        />
      </div>
    </section>
  );
}

function ActionCard({
  icon,
  title,
  description,
  ctaLabel,
  href,
  tour,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  tour?: string;
}) {
  return (
    <Link
      href={href}
      data-tour={tour}
      className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
    >
      <div className="mb-3 grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-neutral-950">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950">
        {ctaLabel}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function YourAgents({ agents, workspaceId }: { agents: AgentOut[]; workspaceId: string }) {
  const top = agents.slice(0, 4);
  const allHref = workspaceId ? ROUTES.agents(workspaceId) : "#";
  const newHref = workspaceId ? ROUTES.newAgent(workspaceId) : "#";

  return (
    <SectionCard
      title="Your agents"
      action={
        agents.length > 0 ? (
          <Link
            href={allHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-950"
          >
            View all ({agents.length})
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null
      }
    >
      {top.length === 0 ? (
        <EmptyAgents newHref={newHref} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {top.map((agent) => (
            <li key={agent.id}>
              <Link
                href={workspaceId ? ROUTES.agentDetail(workspaceId, agent.id) : "#"}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-neutral-50"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-sm font-semibold text-neutral-900">
                  {agent.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-950">
                    {agent.name}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {capitalize(agent.status)} · v{agent.version}
                  </span>
                </span>
                <StatusBadge status={agent.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s === "published"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "inreview" || s === "in_review"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : s === "archived"
          ? "bg-neutral-100 text-neutral-600 border-neutral-200"
          : "bg-neutral-50 text-neutral-700 border-neutral-200";
  const label = s === "inreview" ? "In review" : capitalize(s);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function EmptyAgents({ newHref }: { newHref: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        <Sparkles className="size-4" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-neutral-950">No agents in this workspace</h3>
      <p className="mt-1 max-w-xs text-sm text-neutral-500">
        Create one or hire from the Bazaar to get started.
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          href={newHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-3 text-xs font-medium text-white hover:bg-neutral-800"
        >
          <Plus className="size-3.5" />
          New agent
        </Link>
        <Link
          href={ROUTES.bazaar}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Browse Bazaar
        </Link>
      </div>
    </div>
  );
}

type AuditItem = {
  id: string;
  timestamp: string;
  action: string;
  outcome: string;
  resource_type: string | null;
};

function RecentActivity({
  items,
  workspaceId,
}: {
  items: AuditItem[];
  workspaceId: string;
}) {
  const top = items.slice(0, 5);
  const ccHref = workspaceId ? ROUTES.commandCenter(workspaceId) : "#";

  return (
    <SectionCard
      title="Recent activity"
      action={
        items.length > 0 ? (
          <Link
            href={ccHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-950"
          >
            View audit log
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null
      }
    >
      {top.length === 0 ? (
        <EmptyActivity />
      ) : (
        <ul className="space-y-3">
          {top.map((row) => (
            <ActivityRow key={row.id} item={row} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ActivityRow({ item }: { item: AuditItem }) {
  const icon = pickActivityIcon(item.action, item.outcome);
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block truncate text-sm text-neutral-900">{prettyAction(item.action)}</span>
        <span className="block text-xs text-neutral-500">{formatRelative(item.timestamp)}</span>
      </span>
    </li>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        <Activity className="size-4" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-neutral-950">No activity yet</h3>
      <p className="mt-1 max-w-xs text-sm text-neutral-500">
        Once you start using agents, events will appear here.
      </p>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function prettyAction(action: string): string {
  return action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function pickActivityIcon(action: string, outcome: string): React.ReactNode {
  const a = action.toLowerCase();
  if (outcome === "failure" || a.includes("fail") || a.includes("error")) {
    return <TriangleAlert className="size-4" />;
  }
  if (a.includes("publish") || a.includes("approve")) return <Check className="size-4" />;
  if (a.includes("create") || a.includes("import") || a.includes("upload")) {
    return <Plus className="size-4" />;
  }
  if (a.includes("invite") || a.includes("join") || a.includes("member")) {
    return <UserPlus className="size-4" />;
  }
  return <BarChart3 className="size-4" />;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
