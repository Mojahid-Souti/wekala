"use client";

import { BazaarAgentCard } from "@/components/bazaar/bazaar-agent-card";
import { CategoryFilter } from "@/components/bazaar/category-filter";
import { SearchBar } from "@/components/bazaar/search-bar";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

// Workspace comes from URL in full implementation; placeholder for Phase 3
const WORKSPACE_ID = "";
const TOKEN = "";

export default function BazaarPage() {
  const t = useTranslations("bazaar");
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") ?? "";
  const catParam = searchParams.get("cat") ?? "";
  const selectedCats = catParam ? catParam.split(",").filter(Boolean) : [];
  const [page, setPage] = useState(1);

  const updateUrl = useCallback(
    (newQ: string, newCats: string[]) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (newCats.length) params.set("cat", newCats.join(","));
      router.push(`${ROUTES.bazaar}?${params.toString()}`);
      setPage(1);
    },
    [router]
  );

  const { data: categories } = useQuery({
    queryKey: ["bazaar-categories"],
    queryFn: () => api.bazaar.categories(TOKEN),
    enabled: !!TOKEN,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["bazaar-catalog", q, selectedCats, page],
    queryFn: () => api.bazaar.list(WORKSPACE_ID, TOKEN, { q, cat: selectedCats, page, size: 20 }),
    enabled: !!TOKEN,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("catalog.title")}</h1>
        <Link href={ROUTES.hired} className="text-sm text-indigo-600 hover:underline">
          {t("catalog.filterAll")} →
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchBar
          value={q}
          onChange={(v) => updateUrl(v, selectedCats)}
          placeholder={t("catalog.searchPlaceholder")}
        />
        <CategoryFilter
          categories={categories ?? []}
          selected={selectedCats}
          onChange={(cats) => updateUrl(q, cats)}
          label={t("catalog.filterCategories")}
        />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <p className="mt-10 text-center text-sm text-gray-500">{t("catalog.empty")}</p>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((agent) => (
              <BazaarAgentCard
                key={agent.id}
                agent={agent}
                workspaceId={WORKSPACE_ID}
                token={TOKEN}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span>{data.total} agents</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1">Page {page}</span>
              <button
                type="button"
                disabled={data.items.length < 20}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
