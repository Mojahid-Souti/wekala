"use client";

export const dynamic = "force-dynamic";

import { AgentStatusBadge } from "@/components/agent/agent-status-badge";
import { VersionList } from "@/components/agent/version-list";
import { VettingStatusBadge } from "@/components/vetting/vetting-status-badge";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

type Props = { params: Promise<{ workspaceId: string; agentId: string }> };

export default function AgentDetailPage({ params }: Props) {
  const { workspaceId, agentId } = use(params);
  const t = useTranslations("agent.detail");
  const router = useRouter();
  const qc = useQueryClient();
  const token = useToken();

  const [testQuery, setTestQuery] = useState("");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

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

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    setTestError(null);
    setTestResponse(null);
    try {
      const result = await api.agents.test(workspaceId, agentId, testQuery, token);
      setTestResponse(result.answer);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test failed");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        <div className="h-8 w-1/3 animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-50" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-12 text-center">
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
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-6 lg:px-7">
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
              <span>
                {t("version")} {agent.version}
              </span>
              <span aria-hidden>·</span>
              <span>{agent.classification}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {canPublish && (
              <button
                type="button"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="inline-flex h-8 items-center rounded-md bg-neutral-950 px-3 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {t("publishButton")}
              </button>
            )}
            <Link
              href={ROUTES.agentVetting(workspaceId, agentId)}
              className="inline-flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:border-neutral-400"
            >
              Review &amp; vet
            </Link>
            {agent.status !== "archived" && (
              <button
                type="button"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
                className="inline-flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-50"
              >
                {t("archiveButton")}
              </button>
            )}
            <button
              type="button"
              onClick={() => cloneMutation.mutate()}
              disabled={cloneMutation.isPending}
              className="inline-flex h-8 items-center rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-50"
            >
              {t("cloneButton")}
            </button>
          </div>
        </div>
      </header>

      {/* Sandbox test panel */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {t("testButton")}
        </h2>
        <form onSubmit={handleTest} className="mt-3 flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder={t("testPlaceholder")}
            className="flex-1 rounded-md border border-neutral-200 px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!testQuery.trim()}
            className="inline-flex h-9 min-w-[88px] items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {t("testSendButton")}
          </button>
        </form>
        {testError && (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {testError}
          </p>
        )}
        {testResponse !== null && (
          <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              {t("testResponseLabel")}
            </p>
            <p className="whitespace-pre-wrap text-sm text-neutral-800">{testResponse}</p>
          </div>
        )}
      </section>

      {/* Version history */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {t("versionsTitle")}
        </h2>
        <div className="rounded-xl border border-neutral-200 bg-white">
          <VersionList
            versions={versions ?? []}
            onRollback={(vn) => rollbackMutation.mutate(vn)}
            isRollingBack={rollbackMutation.isPending}
          />
        </div>
      </section>
    </div>
  );
}
