"use client";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewWorkspacePage() {
  const t = useTranslations("workspace.create");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = sessionStorage.getItem("access_token") ?? "";
      await api.workspaces.create(name, token);
      router.push(ROUTES.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
        >
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="workspace-name" className="block text-sm font-medium mb-1">
            {t("nameLabel")}
          </label>
          <input
            id="workspace-name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : t("submitButton")}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            {t("cancelButton")}
          </button>
        </div>
      </form>
    </div>
  );
}
