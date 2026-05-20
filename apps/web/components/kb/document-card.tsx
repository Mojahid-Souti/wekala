"use client";

import type { KBDocumentOut } from "@/lib/api";
import { useTranslations } from "next-intl";

const STATUS_COLOURS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  doc: KBDocumentOut;
  onDelete: (docId: string) => void;
  deleting: boolean;
};

export function DocumentCard({ doc, onDelete, deleting }: Props) {
  const t = useTranslations("knowledgeBase");

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="truncate font-medium text-gray-900">{doc.filename}</span>
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOURS[doc.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {t(`document.status.${doc.status}`)}
          </span>
        </div>
        <div className="mt-1 flex gap-4 text-xs text-gray-500">
          <span>{doc.file_type.toUpperCase()}</span>
          <span>{formatBytes(doc.file_size)}</span>
          {doc.page_count != null && <span>{t("document.pages", { count: doc.page_count })}</span>}
          {doc.token_count != null && (
            <span>{t("document.tokens", { count: doc.token_count })}</span>
          )}
        </div>
        {doc.error_detail && <p className="mt-1 text-xs text-red-600">{doc.error_detail}</p>}
      </div>
      <button
        type="button"
        disabled={deleting}
        onClick={() => {
          if (window.confirm(t("document.deleteConfirm"))) {
            onDelete(doc.id);
          }
        }}
        className="ml-4 shrink-0 rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {t("document.deleteButton")}
      </button>
    </div>
  );
}
