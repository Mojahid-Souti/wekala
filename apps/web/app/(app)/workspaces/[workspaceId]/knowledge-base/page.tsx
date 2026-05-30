"use client";

export const dynamic = "force-dynamic";

import { DocumentList } from "@/components/kb/document-list";
import { SearchResults } from "@/components/kb/search-results";
import { UploadForm } from "@/components/kb/upload-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type KBOut, type KBSearchResultItem, type KBUploadAcceptedOut, api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Database, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";

type Props = { params: Promise<{ workspaceId: string }> };
type DeleteTarget =
  | { kind: "kb"; id: string; name: string }
  | { kind: "doc"; id: string; name: string };

export default function KnowledgeBasePage({ params }: Props) {
  const { workspaceId } = use(params);
  const t = useTranslations("knowledgeBase");
  const qc = useQueryClient();
  const token = useToken();

  const [selectedKBId, setSelectedKBId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("documents");
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KBSearchResultItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Reset all per-KB state when the workspace changes — the component stays
  // mounted across workspace switches, so a KB selected in workspace A would
  // otherwise leak into B's view and query the wrong tenant's documents.
  // biome-ignore lint/correctness/useExhaustiveDependencies: workspaceId is the intentional reset trigger.
  useEffect(() => {
    setSelectedKBId(null);
    setSearchResults(null);
    setSearchQuery("");
    setActiveTab("documents");
  }, [workspaceId]);

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.workspaces.get(workspaceId, token),
    enabled: !!token,
  });

  const { data: kbsData, isLoading: kbsLoading } = useQuery({
    queryKey: ["kbs", workspaceId],
    queryFn: () => api.kb.listKBs(workspaceId, token),
    enabled: !!token,
  });

  const selectedKB: KBOut | null = kbsData?.items.find((kb) => kb.id === selectedKBId) ?? null;

  // Auto-select the first KB once the list loads — without the sidebar there's
  // no list to click, so land the user straight on a knowledge base.
  useEffect(() => {
    if (!selectedKBId && kbsData && kbsData.items.length > 0) {
      setSelectedKBId(kbsData.items[0].id);
    }
  }, [kbsData, selectedKBId]);

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["kb-docs", workspaceId, selectedKBId],
    queryFn: () => api.kb.listDocuments(workspaceId, selectedKBId ?? "", token),
    enabled: !!token && !!selectedKBId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.kb.createKB(workspaceId, { name: createName, description: createDesc }, token),
    onSuccess: (kb) => {
      qc.invalidateQueries({ queryKey: ["kbs", workspaceId] });
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateError(null);
      setSelectedKBId(kb.id);
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const deleteKBMutation = useMutation({
    mutationFn: (kbId: string) => api.kb.deleteKB(workspaceId, kbId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kbs", workspaceId] });
      setSelectedKBId(null);
      setDeleteTarget(null);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) =>
      api.kb.deleteDocument(workspaceId, selectedKBId ?? "", docId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-docs", workspaceId, selectedKBId] });
      setDeleteTarget(null);
    },
    onSettled: () => setDeletingDocId(null),
  });

  const handleUploadDone = (_result: KBUploadAcceptedOut) => {
    qc.invalidateQueries({ queryKey: ["kb-docs", workspaceId, selectedKBId] });
    // Briefly let the "Upload complete" state show, then land on the document
    // list to watch the new file process (pending → ready).
    setSearchResults(null);
    window.setTimeout(() => setActiveTab("documents"), 900);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKBId || !searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    setActiveTab("documents");
    try {
      const res = await api.kb.search(workspaceId, selectedKBId, searchQuery, 10, token);
      setSearchResults(res.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "kb") {
      deleteKBMutation.mutate(deleteTarget.id);
    } else {
      setDeletingDocId(deleteTarget.id);
      deleteDocMutation.mutate(deleteTarget.id);
    }
  }

  const workspaceLabel = workspace?.name ?? t("kb.scope.workspace");
  const deletePending = deleteKBMutation.isPending || deleteDocMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      {/* Page header — KB switcher + create button top-right */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
          <p className="text-sm text-neutral-500">{t("description")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {kbsData && kbsData.items.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-400 data-[state=open]:border-neutral-900"
                >
                  <Database className="size-4 text-neutral-500" />
                  <span className="max-w-[180px] truncate">
                    {selectedKB?.name ?? t("selectKB")}
                  </span>
                  <ChevronDown className="size-4 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1">
                {kbsData.items.map((kb) => (
                  <DropdownMenuItem
                    key={kb.id}
                    onSelect={() => {
                      setSelectedKBId(kb.id);
                      setSearchResults(null);
                      setSearchQuery("");
                      setActiveTab("documents");
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 focus:bg-neutral-100"
                  >
                    <span className="grid size-4 shrink-0 place-items-center">
                      {selectedKBId === kb.id && <Check className="size-3.5 text-neutral-900" />}
                    </span>
                    <Database className="size-4 shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {kb.name}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-400">
                        {workspaceLabel}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setShowCreate(true)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 focus:bg-neutral-100"
                >
                  <span className="grid size-4 shrink-0 place-items-center">
                    <Plus className="size-3.5" />
                  </span>
                  {t("newKB")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <Plus className="size-4" />
            {t("newKB")}
          </button>
        </div>
      </header>

      {/* Full-width content (KB list lives in the header switcher) */}
      <div>
        <main className="min-w-0">
          {kbsLoading ? (
            <div className="h-[420px] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
          ) : !selectedKB ? (
            <div className="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
              <div className="grid size-12 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400">
                <Database className="size-5" />
              </div>
              <p className="mt-4 max-w-sm text-sm text-neutral-500">{t("selectKBPrompt")}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* KB header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-neutral-950">
                    {selectedKB.name}
                  </h2>
                  {selectedKB.description && (
                    <p className="mt-1 text-sm text-neutral-500">{selectedKB.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteTarget({ kind: "kb", id: selectedKB.id, name: selectedKB.name })
                  }
                  aria-label={t("deleteKB")}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Toolbar header: tabs + search */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList>
                    <TabsTrigger value="documents">
                      {t("tabs.documents")} ({docsData?.items.length ?? 0})
                    </TabsTrigger>
                    <TabsTrigger value="upload">{t("tabs.upload")}</TabsTrigger>
                  </TabsList>

                  <form onSubmit={handleSearch} className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("search.placeholder")}
                      className="w-full rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
                    />
                    {searchResults !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchResults(null);
                          setSearchQuery("");
                        }}
                        aria-label={t("search.clear")}
                        className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-neutral-400 hover:text-neutral-700"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </form>
                </div>

                <TabsContent value="documents" className="mt-5">
                  {searching ? (
                    <div className="flex min-h-[200px] items-center justify-center text-sm text-neutral-500">
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t("search.searching")}
                    </div>
                  ) : searchResults !== null ? (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-neutral-500">
                        {t("search.showingResults", { query: searchQuery })}
                      </p>
                      <SearchResults results={searchResults} />
                    </div>
                  ) : (
                    <DocumentList
                      documents={docsData?.items ?? []}
                      loading={docsLoading}
                      deletingDocId={deletingDocId}
                      onDelete={(docId) => {
                        const doc = docsData?.items.find((d) => d.id === docId);
                        setDeleteTarget({
                          kind: "doc",
                          id: docId,
                          name: doc?.filename ?? "this document",
                        });
                      }}
                    />
                  )}
                </TabsContent>

                <TabsContent value="upload" className="mt-5">
                  <UploadForm
                    workspaceId={workspaceId}
                    kbId={selectedKB.id}
                    token={token}
                    onUploaded={handleUploadDone}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>
      </div>

      {/* Create-KB dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createKB.title")}</DialogTitle>
            <DialogDescription>{t("createKB.descriptionPlaceholder")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="kb-name"
                className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                {t("createKB.nameLabel")}
              </label>
              <input
                id="kb-name"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={t("createKB.namePlaceholder")}
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="kb-desc"
                className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                {t("createKB.descriptionLabel")}
              </label>
              <textarea
                id="kb-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder={t("createKB.descriptionPlaceholder")}
                rows={2}
                className="block w-full resize-none rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>
            {createError && <p className="text-sm text-rose-600">{createError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={!createName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {createMutation.isPending ? t("createKB.creating") : t("createKB.createButton")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — centered modal (replaces window.confirm) */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === "kb" ? t("deleteKB") : t("document.deleteButton")}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === "kb" ? t("deleteKBConfirm") : t("document.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              {deleteTarget.name}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deletePending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {deletePending && <Loader2 className="size-3.5 animate-spin" />}
              {t("document.deleteButton")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
