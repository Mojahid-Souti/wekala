"use client";

export const dynamic = "force-dynamic";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await api.auth.resetPassword(email).catch(() => null);
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm text-center">
          <p className="text-gray-700">Check your email for a reset link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
        <p className="text-gray-500 text-sm mb-6">{t("message")}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              {t("emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : t("submitButton")}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link href={ROUTES.login} className="text-blue-600 hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
