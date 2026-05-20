"use client";

export const dynamic = "force-dynamic";

import { AgentCard } from "@/components/agent/agent-card";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { use, useState } from "react";

const STATUS_FILTERS = ["", "draft", "published", "archived"] as const;

type Props = { params: Promise<{ workspaceId: string }> };

export default function AgentsPage({ params }: Props) {
  const { workspaceId } = use(params);
  const t = useTranslations("agent.list");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // token would come from session cookie / context in full implementation
  const token = useToken();

  const { data, isLoading } = useQuery({
    queryKey: ["agents", workspaceId, statusFilter],
    queryFn: () => api.agents.list(workspaceId, token, statusFilter || undefined),
    enabled: !!token,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <Link
          href={ROUTES.newAgent(workspaceId)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {t("createButton")}
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-1 border-b">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === f
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {f
              ? t(`filter${f.charAt(0).toUpperCase() + f.slice(1)}` as "filterDraft")
              : t("filterAll")}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <p className="text-sm text-gray-500">{t("empty")}</p>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((agent) => (
            <AgentCard key={agent.id} agent={agent} workspaceId={workspaceId} />
          ))}
        </div>
      )}
    </div>
  );
}
