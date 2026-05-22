"use client";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AgentToolsPage() {
  const { workspaceId, agentId } = useParams<{ workspaceId: string; agentId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: workspaceTools, isLoading: wsLoading } = useQuery({
    queryKey: ["tools", workspaceId],
    queryFn: () => api.tools.listWorkspaceTools(workspaceId, token),
    enabled: !!token,
  });

  const { data: grantedTools, isLoading: grantedLoading } = useQuery({
    queryKey: ["agent-tools", agentId],
    queryFn: () => api.tools.listAgentTools(workspaceId, agentId, token),
    enabled: !!token,
  });

  const grantMutation = useMutation({
    mutationFn: (toolId: string) => api.tools.grant(workspaceId, agentId, toolId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-tools", agentId] });
      toast("Tool granted to agent.", "success");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Grant failed", "error"),
  });

  const revokeMutation = useMutation({
    mutationFn: (toolId: string) => api.tools.revoke(workspaceId, agentId, toolId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-tools", agentId] });
      toast("Tool revoked.", "info");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Revoke failed", "error"),
  });

  const grantedIds = new Set((grantedTools ?? []).map((t) => t.id));
  const loading = wsLoading || grantedLoading || !token;

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
          <h1 className="text-2xl font-semibold text-gray-900 mt-2">Agent tools</h1>
          <p className="mt-1 text-sm text-gray-500">
            Grant tools to this agent. Only granted tools can be invoked at runtime.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : !workspaceTools || workspaceTools.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center">
          <p className="text-sm text-gray-500 mb-4">No tools available in this workspace yet.</p>
          <Link
            href={ROUTES.mcpServers(workspaceId)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Register an MCP server
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-white divide-y overflow-hidden">
          {workspaceTools.map((t) => {
            const granted = grantedIds.has(t.id);
            return (
              <div key={t.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 font-mono">{t.name}</p>
                  {t.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{t.description}</p>
                  )}
                </div>
                {granted ? (
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(t.id)}
                    disabled={revokeMutation.isPending}
                    className="shrink-0 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => grantMutation.mutate(t.id)}
                    disabled={grantMutation.isPending}
                    className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Grant
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
