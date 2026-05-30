"use client";

import type { KBSearchResultItem } from "@/lib/api";
import { useTranslations } from "next-intl";

type Props = {
  results: KBSearchResultItem[];
};

export function SearchResults({ results }: Props) {
  const t = useTranslations("knowledgeBase.search");

  if (results.length === 0) {
    return <p className="text-sm text-neutral-500">{t("noResults")}</p>;
  }

  return (
    <div className="space-y-2">
      {results.map((r) => (
        <div key={r.chunk_id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {r.content}
          </p>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-400">
            <span className="font-medium text-neutral-600">{r.filename}</span>
            <span>·</span>
            <span>
              {t("source", {
                filename: r.filename,
                page: (r.chunk_metadata?.page_num as number | undefined) ?? "—",
              })}
            </span>
            <span>·</span>
            <span className="font-mono">score {r.rrf_score.toFixed(4)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
