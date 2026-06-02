"use client";

export const dynamic = "force-dynamic";

import { AgentStatusBadge } from "@/components/agent/agent-status-badge";
import { AgentTestPlayground } from "@/components/agent/agent-test-playground";
import { VersionList } from "@/components/agent/version-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VettingStatusBadge } from "@/components/vetting/vetting-status-badge";
import { type AgentOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

type Props = { params: Promise<{ workspaceId: string; agentId: string }> };

export default function AgentDetailPage({ params }: Props) {
  const { workspaceId, agentId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const token = useToken();

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", workspaceId, agentId],
    queryFn: () => api.agents.get(workspaceId, agentId, token),
    enabled: !!token,
  });

  const { data: versions } = useQuery({
    queryKey: ["agent-versions", workspaceId, agentId],
    queryFn: () => api.agents.versions(workspaceId, agentId, token),
    enabled: !!token && !!agent,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.agents.publish(workspaceId, agentId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.agents.archive(workspaceId, agentId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] }),
  });

  const cloneMutation = useMutation({
    mutationFn: () => api.agents.clone(workspaceId, agentId, token),
    onSuccess: (cloned) => router.push(ROUTES.agentDetail(workspaceId, cloned.id)),
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionNum: number) =>
      api.agents.rollback(workspaceId, agentId, versionNum, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      qc.invalidateQueries({ queryKey: ["agent-versions", workspaceId, agentId] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-4 px-5 py-6">
        <div className="h-8 w-1/3 animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-50" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-12 text-center">
        <p className="text-sm text-neutral-500">Agent not found.</p>
        <Link
          href={ROUTES.agents(workspaceId)}
          className="mt-3 inline-flex h-9 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:border-neutral-400"
        >
          ← Back to agents
        </Link>
      </div>
    );
  }

  const canPublish =
    (agent.status === "draft" || agent.status === "in_review") &&
    agent.vetting_status === "approved";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-5 py-6 lg:px-7">
      {/* Header */}
      <header className="space-y-3">
        <Link
          href={ROUTES.agents(workspaceId)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Agents
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950">
              {agent.name}
            </h1>
            {agent.description && <p className="text-sm text-neutral-500">{agent.description}</p>}
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <AgentStatusBadge status={agent.status} />
              <VettingStatusBadge status={agent.vetting_status} />
              <span>v{agent.version}</span>
              <span aria-hidden>·</span>
              <span className="capitalize">{agent.classification}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {canPublish && (
              <Button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                size="sm"
              >
                Publish
              </Button>
            )}
            {agent.status !== "archived" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                Archive
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
            >
              Clone
            </Button>
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-neutral-200">
          <TabsTrigger value="overview" className="flex-none">
            Overview
          </TabsTrigger>
          <TabsTrigger value="versions" className="flex-none">
            Versions
          </TabsTrigger>
          <TabsTrigger value="vetting" className="flex-none">
            Vetting
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex-none">
            Tools
          </TabsTrigger>
          <TabsTrigger value="test" className="flex-none">
            Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-2">
          <OverviewTab agent={agent} />
        </TabsContent>

        <TabsContent value="versions" className="pt-2">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <VersionList
              versions={versions ?? []}
              onRollback={(vn) => rollbackMutation.mutate(vn)}
              isRollingBack={rollbackMutation.isPending}
            />
          </div>
        </TabsContent>

        <TabsContent value="vetting" className="pt-2">
          <LinkPanel
            icon={<ShieldCheck className="size-4" />}
            title="Security vetting"
            description="Run the PII + prompt-injection gatekeeper, review findings, and approve or reject."
            badge={<VettingStatusBadge status={agent.vetting_status} />}
            href={ROUTES.agentVetting(workspaceId, agentId)}
            cta="Open vetting review"
          />
        </TabsContent>

        <TabsContent value="tools" className="pt-2">
          <LinkPanel
            icon={<Wrench className="size-4" />}
            title="Tools"
            description="Grant this agent tools from the workspace catalog and test them in the playground."
            href={ROUTES.agentTools(workspaceId, agentId)}
            cta="Manage tools"
          />
        </TabsContent>

        <TabsContent value="test" className="pt-2">
          <AgentTestPlayground workspaceId={workspaceId} agentId={agentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ agent }: { agent: AgentOut }) {
  const fields: { label: string; value: string }[] = [
    { label: "Status", value: prettify(agent.status) },
    { label: "Vetting", value: prettify(agent.vetting_status) },
    { label: "Classification", value: prettify(agent.classification) },
    { label: "Language", value: agent.language ?? "—" },
    { label: "Version", value: `v${agent.version}` },
    { label: "Created", value: formatDate(agent.created_at) },
    { label: "Updated", value: formatDate(agent.updated_at) },
  ];
  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm leading-relaxed text-neutral-700">
        {agent.description || "No description provided."}
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              {f.label}
            </dt>
            <dd className="mt-0.5 text-sm text-neutral-900">{f.value}</dd>
          </div>
        ))}
      </dl>
      {agent.tags && agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
          {agent.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkPanel({
  icon,
  title,
  description,
  badge,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
            {badge}
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={href}>
          {cta}
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function prettify(s: string): string {
  return s.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
