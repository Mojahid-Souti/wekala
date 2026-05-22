"use client";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ToolsCatalogPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();

  const { data: tools, isLoading } = useQuery({
    queryKey: ["tools", workspaceId],
    queryFn: () => api.tools.listWorkspaceTools(workspaceId, token),
    enabled: !!token,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tools</h1>
          <p className="mt-1 text-sm text-gray-500">
            All tools discovered from your workspace&apos;s MCP servers.
          </p>
        </div>
        <Link
          href={ROUTES.mcpServers(workspaceId)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Manage MCP servers
        </Link>
      </div>

      {!token || isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : !tools || tools.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center">
          <p className="text-sm text-gray-500 mb-4">No tools yet.</p>
          <p className="text-xs text-gray-400 mb-6">
            Register an MCP server, then run discovery to populate the catalog.
          </p>
          <Link
            href={ROUTES.mcpServers(workspaceId)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Register an MCP server
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-white divide-y overflow-hidden">
          {tools.map((t) => (
            <div key={t.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 font-mono">{t.name}</p>
                  {t.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{t.description}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === "active"
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
