"use client";

export const dynamic = "force-dynamic";

import { AgentStatusBadge } from "@/components/agent/agent-status-badge";
import { VersionList } from "@/components/agent/version-list";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
  });

  const { data: versions } = useQuery({
    queryKey: ["agent-versions", workspaceId, agentId],
    queryFn: () => api.agents.versions(workspaceId, agentId, token),
    enabled: !!agent,
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
    return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (!agent) {
    return <p className="text-sm text-gray-500">Agent not found.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
          {agent.description && <p className="mt-1 text-sm text-gray-500">{agent.description}</p>}
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            <AgentStatusBadge status={agent.status} />
            <span>
              {t("version")} {agent.version}
            </span>
            <span>·</span>
            <span>{agent.classification}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(agent.status === "draft" || agent.status === "in_review") && (
            <button
              type="button"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {t("publishButton")}
            </button>
          )}
          {agent.status !== "archived" && (
            <button
              type="button"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("archiveButton")}
            </button>
          )}
          <button
            type="button"
            onClick={() => cloneMutation.mutate()}
            disabled={cloneMutation.isPending}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("cloneButton")}
          </button>
        </div>
      </div>

      {/* Sandbox test panel */}
      <section className="rounded-lg border bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">{t("testButton")}</h2>
        <form onSubmit={handleTest} className="flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder={t("testPlaceholder")}
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!testQuery.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {t("testSendButton")}
          </button>
        </form>
        {testError && <p className="mt-2 text-xs text-red-600">{testError}</p>}
        {testResponse !== null && (
          <div className="mt-3 rounded-md bg-gray-50 p-3">
            <p className="mb-1 text-xs font-medium text-gray-500">{t("testResponseLabel")}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{testResponse}</p>
          </div>
        )}
      </section>

      {/* Version history */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-800">{t("versionsTitle")}</h2>
        <VersionList
          versions={versions ?? []}
          onRollback={(vn) => rollbackMutation.mutate(vn)}
          isRollingBack={rollbackMutation.isPending}
        />
      </section>
    </div>
  );
}
