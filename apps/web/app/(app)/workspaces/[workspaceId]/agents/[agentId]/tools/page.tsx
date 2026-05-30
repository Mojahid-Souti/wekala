"use client";

import { ToolPlayground } from "@/components/tools/tool-playground";
import { type ToolOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play, Plus, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function AgentToolsPage() {
  const { workspaceId, agentId } = useParams<{ workspaceId: string; agentId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [playgroundTool, setPlaygroundTool] = useState<ToolOut | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

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
    onSettled: () => setPendingId(null),
  });

  const revokeMutation = useMutation({
    mutationFn: (toolId: string) => api.tools.revoke(workspaceId, agentId, toolId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-tools", agentId] });
      toast("Tool revoked.", "info");
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Revoke failed", "error"),
    onSettled: () => setPendingId(null),
  });

  const grantedIds = new Set((grantedTools ?? []).map((t) => t.id));
  const loading = wsLoading || grantedLoading || !token;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      {/* Header */}
      <header className="mb-6 space-y-1.5">
        <Link
          href={ROUTES.agentDetail(workspaceId, agentId)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="size-3.5" />
          Back to agent
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Agent tools</h1>
        <p className="text-sm text-neutral-500">
          Grant tools to this agent — only granted tools can be invoked at runtime. Use{" "}
          <span className="font-medium text-neutral-700">Run</span> to test one with live inputs.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["a", "b", "c"].map((k) => (
            <div
              key={`at-skel-${k}`}
              className="h-28 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      ) : !workspaceTools || workspaceTools.length === 0 ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
          <div className="grid size-12 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400">
            <Wrench className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-neutral-950">No tools available</h3>
          <p className="mt-1.5 max-w-sm text-sm text-neutral-500">
            Register an MCP server and discover its tools to grant them here.
          </p>
          <Link
            href={ROUTES.mcpServers(workspaceId)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <Plus className="size-4" />
            Register an MCP server
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaceTools.map((t) => {
            const granted = grantedIds.has(t.id);
            const busy = pendingId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-white p-4 transition-colors",
                  granted ? "border-neutral-300" : "border-neutral-200 hover:border-neutral-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
                    <Wrench className="size-4" />
                  </div>
                  {granted && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Granted
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-sm font-medium text-neutral-900"
                    title={t.name}
                  >
                    {t.name}
                  </p>
                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
                      {t.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {granted ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPlaygroundTool(t)}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-neutral-950 px-3 text-xs font-medium text-white transition-colors hover:bg-neutral-800"
                      >
                        <Play className="size-3.5" />
                        Run
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingId(t.id);
                          revokeMutation.mutate(t.id);
                        }}
                        disabled={busy}
                        className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Revoke"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingId(t.id);
                        grantMutation.mutate(t.id);
                      }}
                      disabled={busy}
                      className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      Grant
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {playgroundTool && (
        <ToolPlayground
          workspaceId={workspaceId}
          agentId={agentId}
          tool={playgroundTool}
          open={playgroundTool !== null}
          onOpenChange={(o) => !o && setPlaygroundTool(null)}
        />
      )}
    </div>
  );
}
