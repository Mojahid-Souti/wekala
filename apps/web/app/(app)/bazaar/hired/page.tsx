"use client";

import { BazaarAgentCard } from "@/components/bazaar/bazaar-agent-card";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

const WORKSPACE_ID = "";
const TOKEN = "";

export default function HiredPage() {
  const t = useTranslations("bazaar.hired");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["hires", WORKSPACE_ID, page],
    queryFn: () => api.hires.list(WORKSPACE_ID, TOKEN, page),
    enabled: !!TOKEN,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <p className="mt-10 text-center text-sm text-gray-500">{t("empty")}</p>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((agent) => (
              <BazaarAgentCard
                key={agent.id}
                agent={{ ...agent, hired: true }}
                workspaceId={WORKSPACE_ID}
                token={TOKEN}
                onUnhire={() => qc.invalidateQueries({ queryKey: ["hires", WORKSPACE_ID] })}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.items.length < 20}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
