"use client";

export const dynamic = "force-dynamic";

import { DocumentCard } from "@/components/kb/document-card";
import { SearchResults } from "@/components/kb/search-results";
import { UploadForm } from "@/components/kb/upload-form";
import { type KBOut, type KBSearchResultItem, type KBUploadAcceptedOut, api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { use, useState } from "react";

type Props = { params: Promise<{ workspaceId: string }> };

export default function KnowledgeBasePage({ params }: Props) {
  const { workspaceId } = use(params);
  const t = useTranslations("knowledgeBase");
  const qc = useQueryClient();
  const token = "";

  const [selectedKB, setSelectedKB] = useState<KBOut | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KBSearchResultItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const { data: kbsData, isLoading: kbsLoading } = useQuery({
    queryKey: ["kbs", workspaceId],
    queryFn: () => api.kb.listKBs(workspaceId, token),
    enabled: !!token,
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["kb-docs", workspaceId, selectedKB?.id],
    queryFn: () => api.kb.listDocuments(workspaceId, selectedKB?.id ?? "", token),
    enabled: !!token && !!selectedKB,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.kb.createKB(workspaceId, { name: createName, description: createDesc }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kbs", workspaceId] });
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateError(null);
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) =>
      api.kb.deleteDocument(workspaceId, selectedKB?.id ?? "", docId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-docs", workspaceId, selectedKB?.id] }),
  });

  const handleUploadDone = (result: KBUploadAcceptedOut) => {
    setUploadSuccess(result.duplicate ? t("upload.duplicateMessage") : t("upload.successMessage"));
    qc.invalidateQueries({ queryKey: ["kb-docs", workspaceId, selectedKB?.id] });
    setTimeout(() => setUploadSuccess(null), 5000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKB || !searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await api.kb.search(workspaceId, selectedKB.id, searchQuery, 10, token);
      setSearchResults(res.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex min-h-0 gap-6">
      {/* Left panel: KB list */}
      <aside className="w-64 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            +
          </button>
        </div>

        {kbsLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {kbsData?.items.length === 0 && <p className="text-sm text-gray-400">{t("emptyKBs")}</p>}

        <nav className="space-y-1">
          {kbsData?.items.map((kb) => (
            <button
              key={kb.id}
              type="button"
              onClick={() => {
                setSelectedKB(kb);
                setSearchResults(null);
              }}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selectedKB?.id === kb.id ? "bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
            >
              <span className="block truncate font-medium">{kb.name}</span>
              <span
                className={`text-xs ${selectedKB?.id === kb.id ? "text-indigo-200" : "text-gray-400"}`}
              >
                {t(`kb.scope.${kb.scope}`)}
              </span>
            </button>
          ))}
        </nav>

        {/* Create KB modal-ish inline form */}
        {showCreate && (
          <div className="mt-4 rounded-lg border bg-white p-4 shadow">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">{t("createKB.title")}</h3>
            <label htmlFor="kb-name" className="mb-1 block text-xs text-gray-600">
              {t("createKB.nameLabel")}
            </label>
            <input
              id="kb-name"
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t("createKB.namePlaceholder")}
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <label htmlFor="kb-desc" className="mb-1 block text-xs text-gray-600">
              {t("createKB.descriptionLabel")}
            </label>
            <textarea
              id="kb-desc"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder={t("createKB.descriptionPlaceholder")}
              rows={2}
              className="mb-3 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {createError && <p className="mb-2 text-xs text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!createName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? t("createKB.creating") : t("createKB.createButton")}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Right panel: selected KB content */}
      <main className="min-w-0 flex-1">
        {!selectedKB ? (
          <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed text-sm text-gray-400">
            {t("emptyKBs")}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedKB.name}</h1>
                {selectedKB.description && (
                  <p className="mt-1 text-sm text-gray-500">{selectedKB.description}</p>
                )}
              </div>
            </div>

            {/* Upload section */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-800">{t("upload.title")}</h2>
              <UploadForm
                workspaceId={workspaceId}
                kbId={selectedKB.id}
                token={token}
                onUploaded={handleUploadDone}
              />
              {uploadSuccess && <p className="mt-2 text-sm text-green-700">{uploadSuccess}</p>}
            </section>

            {/* Documents list */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-800">{t("title")}</h2>
              {docsLoading && <p className="text-sm text-gray-400">Loading…</p>}
              {!docsLoading && docsData?.items.length === 0 && (
                <p className="text-sm text-gray-400">{t("emptyKBs")}</p>
              )}
              <div className="space-y-2">
                {docsData?.items.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onDelete={(docId) => {
                      setDeletingDocId(docId);
                      deleteDocMutation.mutate(docId, {
                        onSettled: () => setDeletingDocId(null),
                      });
                    }}
                    deleting={deletingDocId === doc.id}
                  />
                ))}
              </div>
            </section>

            {/* Search section */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-800">
                {t("search.resultsTitle")}
              </h2>
              <form onSubmit={handleSearch} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("search.placeholder")}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || searching}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {searching ? t("search.searching") : t("search.searchButton")}
                </button>
              </form>
              {searchResults !== null && <SearchResults results={searchResults} />}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
