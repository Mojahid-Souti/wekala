"use client";

import type { KBSearchResultItem } from "@/lib/api";
import { useTranslations } from "next-intl";

type Props = {
  results: KBSearchResultItem[];
};

export function SearchResults({ results }: Props) {
  const t = useTranslations("knowledgeBase.search");

  if (results.length === 0) {
    return <p className="text-sm text-gray-500">{t("noResults")}</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">{t("resultsTitle")}</h3>
      {results.map((r) => (
        <div key={r.chunk_id} className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{r.content}</p>
          <p className="mt-2 text-xs text-gray-400">
            {t("source", {
              filename: r.filename,
              page: (r.chunk_metadata?.page_num as number | undefined) ?? "—",
            })}
            {" · "}score {r.rrf_score.toFixed(4)}
          </p>
        </div>
      ))}
    </div>
  );
}
