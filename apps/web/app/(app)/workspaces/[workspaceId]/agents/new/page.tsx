"use client";

export const dynamic = "force-dynamic";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

type Props = { params: Promise<{ workspaceId: string }> };
type Tab = "upload" | "template";

export default function NewAgentPage({ params }: Props) {
  const { workspaceId } = use(params);
  const t = useTranslations("agent.new");
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useToken();

  const { data: templates } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.templates.list(token),
    enabled: tab === "template",
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const agent = await api.agents.importYaml(workspaceId, file, token);
      router.push(ROUTES.agentDetail(workspaceId, agent.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("../../errors.importFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTemplate(templateId: string) {
    setIsSubmitting(true);
    setError(null);
    try {
      const agent = await api.agents.importTemplate(workspaceId, templateId, token);
      router.push(ROUTES.agentDetail(workspaceId, agent.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("../../errors.importFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t("title")}</h1>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 border-b">
        {(["upload", "template"] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabId
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tabId === "upload" ? t("tabUpload") : t("tabTemplate")}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {tab === "upload" && (
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="yaml-file" className="block text-sm font-medium text-gray-700">
              {t("uploadLabel")}
            </label>
            <p className="mt-1 text-xs text-gray-500">{t("uploadHint")}</p>
            <input
              id="yaml-file"
              type="file"
              accept=".yaml,.yml"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!file || isSubmitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "Importing…" : t("uploadButton")}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("cancelButton")}
            </button>
          </div>
        </form>
      )}

      {tab === "template" && (
        <div>
          <h2 className="mb-4 text-sm font-medium text-gray-700">{t("templatePickerTitle")}</h2>
          {!templates && <p className="text-sm text-gray-400">Loading templates…</p>}
          {templates && templates.length === 0 && (
            <p className="text-sm text-gray-400">No templates available.</p>
          )}
          <div className="grid gap-3">
            {templates?.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{tmpl.name}</p>
                  {tmpl.description && <p className="text-xs text-gray-500">{tmpl.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleTemplate(tmpl.id)}
                  disabled={isSubmitting}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {t("useTemplateButton")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
