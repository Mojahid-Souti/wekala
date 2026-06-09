"use client";

export const dynamic = "force-dynamic";

import { AgentCard } from "@/components/agent/agent-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileUp,
  LayoutTemplate,
  Pencil,
  Plus,
  Search,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useMemo, useState } from "react";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "inreview", label: "In review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "All" },
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "restricted", label: "Restricted" },
  { value: "confidential", label: "Confidential" },
];

const VETTING_OPTIONS = [
  { value: "", label: "All" },
  { value: "unvetted", label: "Unvetted" },
  { value: "ready_for_review", label: "Ready for review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name (A–Z)" },
  { value: "status", label: "Status" },
];

type Props = { params: Promise<{ workspaceId: string }> };

export default function AgentsPage({ params }: Props) {
  const { workspaceId } = use(params);
  const token = useToken();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  // Filters/sort live in the URL so they're shareable and survive Back.
  const statusFilter = searchParams.get("status") ?? "";
  const classFilter = searchParams.get("class") ?? "";
  const vettingFilter = searchParams.get("vetting") ?? "";
  const sortBy = searchParams.get("sort") ?? "updated";

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.replace(sp.toString() ? `${pathname}?${sp}` : pathname, { scroll: false });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["agents", workspaceId, statusFilter],
    queryFn: () => api.agents.list(workspaceId, token, statusFilter || undefined),
    enabled: !!token,
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter((a) => {
      if (
        q &&
        !(a.name.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q))
      ) {
        return false;
      }
      if (classFilter && (a.classification ?? "").toLowerCase() !== classFilter) return false;
      if (vettingFilter && (a.vetting_status ?? "").toLowerCase() !== vettingFilter) return false;
      return true;
    });
    return out.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status);
      return (b.updated_at ?? "").localeCompare(a.updated_at ?? ""); // updated desc
    });
  }, [items, query, classFilter, vettingFilter, sortBy]);

  const counts = useMemo(() => {
    const total = items.length;
    const byStatus = items.reduce<Record<string, number>>((acc, a) => {
      const k = a.status.toLowerCase();
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    return { total, byStatus };
  }, [items]);

  const hasFilters = !!(query || statusFilter || classFilter || vettingFilter);

  function clearAll() {
    setQuery("");
    router.replace(pathname, { scroll: false });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-5 py-6 lg:px-7">
      <header className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Agents</h1>
        <p className="text-sm text-neutral-500">
          {counts.total === 0
            ? "No agents in this workspace yet."
            : `${counts.total} ${counts.total === 1 ? "agent" : "agents"}${
                counts.byStatus.published ? ` · ${counts.byStatus.published} published` : ""
              }${counts.byStatus.inreview ? ` · ${counts.byStatus.inreview} in review` : ""}${
                counts.byStatus.draft ? ` · ${counts.byStatus.draft} drafts` : ""
              }`}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-950">Create an agent</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            icon={<Pencil className="size-4" />}
            title="Build from scratch"
            description="Open the visual canvas to design nodes, prompts, and flows."
            ctaLabel="Open canvas"
            href={ROUTES.agentsBuild(workspaceId)}
          />
          <ActionCard
            icon={<Workflow className="size-4" />}
            title="Build in Dify"
            description="Design an agent in the Dify studio, then import it back here."
            ctaLabel="Open Dify"
            href={`${ROUTES.newAgent(workspaceId)}?tab=dify`}
          />
          <ActionCard
            icon={<LayoutTemplate className="size-4" />}
            title="Pick a template"
            description="Start from a vetted template and customize it for your team."
            ctaLabel="Browse templates"
            href={ROUTES.agentsTemplates(workspaceId)}
          />
          <ActionCard
            icon={<FileUp className="size-4" />}
            title="Import a YAML"
            description="Upload an existing Dify agent definition to register it here."
            ctaLabel="Upload YAML"
            href={ROUTES.agentsImport(workspaceId)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold text-neutral-950">Your agents</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                <Search className="size-4" />
              </span>
              <input
                type="text"
                placeholder="Search agents…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-200 sm:w-56"
              />
            </div>
            <FilterMenu
              label="Class"
              value={classFilter}
              options={CLASSIFICATION_OPTIONS}
              onChange={(v) => setParam("class", v)}
            />
            <FilterMenu
              label="Vetting"
              value={vettingFilter}
              options={VETTING_OPTIONS}
              onChange={(v) => setParam("vetting", v)}
            />
            <FilterMenu
              label="Sort"
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(v) => setParam("sort", v)}
            />
            <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => setParam("status", f.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-neutral-950 text-white"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyAgents workspaceId={workspaceId} filtering={hasFilters} onClear={clearAll} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} workspaceId={workspaceId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 data-[state=open]:border-neutral-900"
        >
          <span className="text-neutral-400">{label}:</span>
          {current?.label ?? "All"}
          <ChevronDown className="size-3.5 text-neutral-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem] p-1">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value || "all"}
            onSelect={() => onChange(o.value)}
            className="flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm focus:bg-neutral-100"
          >
            {o.label}
            {value === o.value && <Check className="size-3.5 text-neutral-900" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionCard({
  icon,
  title,
  description,
  ctaLabel,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
    >
      <div className="mb-3 grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-neutral-950">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-950">
        {ctaLabel}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function EmptyAgents({
  workspaceId,
  filtering,
  onClear,
}: {
  workspaceId: string;
  filtering: boolean;
  onClear: () => void;
}) {
  if (filtering) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center">
        <p className="text-sm text-neutral-500">No agents match these filters.</p>
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-sm font-medium text-neutral-950 underline underline-offset-4 hover:no-underline"
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white py-12 text-center">
      <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
        <Pencil className="size-4" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-neutral-950">No agents in this workspace</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        Use one of the options above to create or import your first agent.
      </p>
      <Link
        href={ROUTES.agentsBuild(workspaceId)}
        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800"
      >
        <Plus className="size-3.5" />
        New agent
      </Link>
    </div>
  );
}
