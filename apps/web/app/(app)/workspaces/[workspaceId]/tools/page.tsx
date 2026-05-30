"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { type ToolOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plug, Server, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

type ToolGroup = {
  serverId: string;
  name: string;
  url?: string;
  builtin: boolean;
  tools: ToolOut[];
};

export default function ToolsCatalogPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();

  const { data: tools, isLoading } = useQuery({
    queryKey: ["tools", workspaceId],
    queryFn: () => api.tools.listWorkspaceTools(workspaceId, token),
    enabled: !!token,
  });

  const { data: servers } = useQuery({
    queryKey: ["mcp-servers", workspaceId],
    queryFn: () => api.mcpServers.list(workspaceId, token),
    enabled: !!token,
  });

  // Group discovered tools under the MCP server they came from.
  const groups = useMemo<ToolGroup[]>(() => {
    const byServer = new Map<string, ToolGroup>();
    const serverMap = new Map((servers ?? []).map((s) => [s.id, s]));
    for (const t of tools ?? []) {
      let g = byServer.get(t.mcp_server_id);
      if (!g) {
        const s = serverMap.get(t.mcp_server_id);
        g = {
          serverId: t.mcp_server_id,
          name: s?.name ?? "Unknown server",
          url: s?.url,
          builtin: s?.is_builtin ?? false,
          tools: [],
        };
        byServer.set(t.mcp_server_id, g);
      }
      g.tools.push(t);
    }
    return Array.from(byServer.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tools, servers]);

  const total = tools?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Tools</h1>
          <p className="text-sm text-neutral-500">
            Every tool discovered from your workspace&apos;s MCP servers, grouped by server. Grant
            them to agents to extend what they can do.
          </p>
        </div>
        <Link
          href={ROUTES.mcpServers(workspaceId)}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
        >
          <Server className="size-4" />
          Manage MCP servers
        </Link>
      </header>

      {!token || isLoading ? (
        <div className="space-y-3">
          {["a", "b"].map((k) => (
            <div
              key={`tool-skel-${k}`}
              className="h-20 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
          <div className="grid size-12 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400">
            <Wrench className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-neutral-950">No tools yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-neutral-500">
            Register an MCP server, then run discovery to populate the catalog.
          </p>
          <Link
            href={ROUTES.mcpServers(workspaceId)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <Plug className="size-4" />
            Register an MCP server
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {total} tool{total === 1 ? "" : "s"} · {groups.length} server
            {groups.length === 1 ? "" : "s"}
          </p>
          {groups.map((g) => (
            <ServerGroup key={g.serverId} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServerGroup({ group }: { group: ToolGroup }) {
  return (
    <Collapsible
      defaultOpen
      className="overflow-hidden rounded-xl border border-neutral-200 bg-white"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
            <Server className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-neutral-900">{group.name}</span>
              {group.builtin && (
                <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                  built-in
                </span>
              )}
            </div>
            {group.url && (
              <span className="block truncate font-mono text-xs text-neutral-400">{group.url}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {group.tools.length}
          </span>
          <ChevronDown className="size-4 text-neutral-400 transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 gap-3 border-t border-neutral-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {group.tools.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
                  <Wrench className="size-4" />
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="min-w-0">
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
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-500"
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-neutral-400")} />
      {status}
    </span>
  );
}
