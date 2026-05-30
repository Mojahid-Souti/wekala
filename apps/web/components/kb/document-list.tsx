"use client";

import type { KBDocumentOut } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  LayoutGrid,
  Loader2,
  Table as TableIcon,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type ViewMode = "grid" | "table";

type Props = {
  documents: KBDocumentOut[];
  loading: boolean;
  onDelete: (docId: string) => void;
  deletingDocId: string | null;
};

export function DocumentList({ documents, loading, onDelete, deletingDocId }: Props) {
  const t = useTranslations("knowledgeBase");
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {t("documentsTitle")} ({documents.length})
        </h2>
        <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            aria-label={t("viewAsGrid")}
            aria-pressed={view === "grid"}
            className={cn(
              "grid size-7 place-items-center rounded transition-colors",
              view === "grid"
                ? "bg-neutral-950 text-white"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-label={t("viewAsTable")}
            aria-pressed={view === "table"}
            className={cn(
              "grid size-7 place-items-center rounded transition-colors",
              view === "table"
                ? "bg-neutral-950 text-white"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <TableIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {["a", "b", "c"].map((k) => (
            <div
              key={`doc-skel-${k}`}
              className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center">
          <div className="grid size-11 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400">
            <FileText className="size-5" />
          </div>
          <p className="mt-3 text-sm text-neutral-500">{t("emptyDocs")}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentGridCard
              key={doc.id}
              doc={doc}
              onDelete={onDelete}
              deleting={deletingDocId === doc.id}
            />
          ))}
        </div>
      ) : (
        <DocumentTable documents={documents} onDelete={onDelete} deletingDocId={deletingDocId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("knowledgeBase.document.status");
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    ready: {
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: <CheckCircle2 className="size-3" />,
    },
    processing: {
      cls: "border-neutral-200 bg-neutral-50 text-neutral-600",
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    pending: {
      cls: "border-neutral-200 bg-neutral-50 text-neutral-600",
      icon: <Loader2 className="size-3" />,
    },
    failed: {
      cls: "border-rose-200 bg-rose-50 text-rose-700",
      icon: <AlertCircle className="size-3" />,
    },
  };
  const entry = map[status] ?? map.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        entry.cls
      )}
    >
      {entry.icon}
      {t(status)}
    </span>
  );
}

function DeleteButton({
  onConfirm,
  deleting,
  className,
}: {
  onConfirm: () => void;
  deleting: boolean;
  className?: string;
}) {
  const t = useTranslations("knowledgeBase.document");
  return (
    <button
      type="button"
      disabled={deleting}
      onClick={(e) => {
        e.stopPropagation();
        onConfirm();
      }}
      aria-label={t("deleteButton")}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40",
        className
      )}
    >
      {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Grid card
// ---------------------------------------------------------------------------

function DocumentGridCard({
  doc,
  onDelete,
  deleting,
}: {
  doc: KBDocumentOut;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300">
      <div className="flex items-start justify-between gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
          <FileText className="size-4" />
        </div>
        <DeleteButton onConfirm={() => onDelete(doc.id)} deleting={deleting} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900" title={doc.filename}>
          {doc.filename}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {doc.file_type.toUpperCase()} · {formatBytes(doc.file_size)}
          {doc.page_count != null && ` · ${doc.page_count}p`}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <StatusBadge status={doc.status} />
      </div>
      {doc.error_detail && (
        <p className="line-clamp-2 text-xs text-rose-600" title={doc.error_detail}>
          {doc.error_detail}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function DocumentTable({
  documents,
  onDelete,
  deletingDocId,
}: {
  documents: KBDocumentOut[];
  onDelete: (id: string) => void;
  deletingDocId: string | null;
}) {
  const t = useTranslations("knowledgeBase.table");
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-100 text-xs uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t("name")}</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("type")}</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t("size")}</th>
            <th className="px-4 py-2.5 font-medium">{t("status")}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={doc.id}
              className="border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-7 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-600">
                    <FileText className="size-3.5" />
                  </div>
                  <span
                    className="truncate text-sm font-medium text-neutral-900"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </span>
                </div>
              </td>
              <td className="hidden px-4 py-3 text-xs text-neutral-600 sm:table-cell">
                {doc.file_type.toUpperCase()}
              </td>
              <td className="hidden px-4 py-3 text-xs text-neutral-600 md:table-cell">
                {formatBytes(doc.file_size)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={doc.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <DeleteButton
                  onConfirm={() => onDelete(doc.id)}
                  deleting={deletingDocId === doc.id}
                  className="ml-auto"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
