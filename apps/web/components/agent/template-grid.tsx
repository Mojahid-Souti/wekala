"use client";

import { TemplateCard } from "@/components/agent/template-card";
import { TemplateDetailSheet } from "@/components/agent/template-detail-sheet";
import { Input } from "@/components/ui/input";
import type { TemplateOut } from "@/lib/api";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  List,
  type LucideIcon,
  MessageCircle,
  Monitor,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ROW_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Monitor,
  BookOpen,
  Users,
  TrendingUp,
  FileText,
  ShieldCheck,
  MessageCircle,
};

type ViewMode = "grid" | "list";

const CATEGORIES = [
  "All",
  "Customer support",
  "Internal Q&A",
  "Document Q&A",
  "HR",
  "Sales",
  "Engineering",
  "Operations",
];

export function TemplateGrid({ workspaceId }: { workspaceId: string }) {
  const [templates, setTemplates] = useState<TemplateOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selected, setSelected] = useState<TemplateOut | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = getToken();
        if (!token) throw new Error("Not signed in");
        const list = await api.templates.list(token);
        if (!cancelled) setTemplates(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesCategory = activeCategory === "All" || t.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      const haystack = [
        t.name,
        t.description,
        ...(t.tags ?? []),
        ...(t.connectors ?? []),
        t.category ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [templates, query, activeCategory]);

  return (
    <>
      <div className="space-y-5">
        {/* Search */}
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search by name, role, or connector…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Category chips + view toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeCategory === c
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div
            className="flex shrink-0 items-center gap-0 rounded-md border border-neutral-200 bg-white p-0.5"
            // biome-ignore lint/a11y/useSemanticElements: role="group" is correct ARIA for a toggle cluster; fieldset is for forms.
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "grid size-7 place-items-center rounded transition-colors",
                viewMode === "grid"
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={cn(
                "grid size-7 place-items-center rounded transition-colors",
                viewMode === "list"
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Grid */}
        {templates === null && !error ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
              <div
                key={`skel-${k}`}
                className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            Could not load templates: {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
              <LayoutTemplate className="size-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-neutral-950">
              {templates?.length === 0
                ? "Template library coming soon"
                : "No templates match your filter"}
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-neutral-500">
              {templates?.length === 0
                ? "We're curating a starter library of vetted agents — customer support, internal Q&A, document summarizers, and more."
                : "Try clearing the search or picking a different category."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onSelect={(tpl) => {
                  setSelected(tpl);
                  setSheetOpen(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Classification</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Connectors</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const RowIcon = ROW_ICONS[t.icon_name ?? "Sparkles"] ?? Sparkles;
                  return (
                    <tr
                      key={t.id}
                      tabIndex={0}
                      onClick={() => {
                        setSelected(t);
                        setSheetOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(t);
                          setSheetOpen(true);
                        }
                      }}
                      className="cursor-pointer border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50 focus:outline-none focus-visible:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-7 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700">
                            <RowIcon className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-neutral-950">
                              {t.name}
                            </div>
                            <div className="truncate text-xs text-neutral-500">{t.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-neutral-700 md:table-cell">
                        {t.category ?? "Other"}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-neutral-700 md:table-cell">
                        {t.classification ?? "Internal"}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-neutral-500 lg:table-cell">
                        {(t.connectors ?? []).length > 0 ? (t.connectors ?? []).join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-400">→</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer fallbacks */}
        {templates !== null && (
          <div className="mt-10 flex flex-col items-center gap-3 border-t border-neutral-100 pt-8 text-center">
            <p className="text-sm text-neutral-500">Can't find what you need?</p>
            <div className="flex gap-2">
              <a
                href={`/workspaces/${workspaceId}/agents/build`}
                className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:border-neutral-400"
              >
                + Build from scratch
              </a>
              <a
                href={`/workspaces/${workspaceId}/agents/import`}
                className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:border-neutral-400"
              >
                ↑ Upload YAML
              </a>
            </div>
          </div>
        )}
      </div>

      <TemplateDetailSheet
        template={selected}
        workspaceId={workspaceId}
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSelected(null);
        }}
      />
    </>
  );
}
