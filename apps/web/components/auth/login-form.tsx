"use client";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const te = useTranslations("auth.errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api.auth.login(email, password);
      // Store token in sessionStorage (no cookies = no CSRF risk)
      sessionStorage.setItem("access_token", session.access_token);
      router.push(ROUTES.dashboard);
    } catch {
      setError(te("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      {expired && !error && (
        <output className="mb-4 block rounded bg-amber-50 px-3 py-2 text-sm text-amber-800 border border-amber-200">
          Your session expired. Please sign in again.
        </output>
      )}
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
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            {t("emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end">
          <Link href={ROUTES.resetPassword} className="text-xs text-blue-600 hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Signing in…" : t("submitButton")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        {t("noAccount")}{" "}
        <Link href={ROUTES.signup} className="text-blue-600 hover:underline">
          {t("signUpLink")}
        </Link>
      </p>
    </div>
  );
}
