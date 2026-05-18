"use client";

export const dynamic = "force-dynamic";

import { ROUTES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function VerifyForm() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError(t("noEmail"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "signup",
      });
      if (verifyError) throw verifyError;
      setDone(true);
      // Sign out immediately — user should log in fresh
      await supabase.auth.signOut();
      setTimeout(() => router.push(ROUTES.login), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("expired") || msg.includes("invalid") ? t("invalidCode") : msg);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border bg-white p-8 shadow-sm text-center">
        <div className="mb-4 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
            ✓
          </span>
        </div>
        <h1 className="text-xl font-semibold mb-2 text-gray-900">{t("successTitle")}</h1>
        <p className="text-sm text-gray-500">{t("successMessage")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold mb-2">{t("title")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {t("message")} {email && <span className="font-medium text-gray-800">{email}</span>}
      </p>

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
          <label htmlFor="otp-code" className="block text-sm font-medium mb-1">
            {t("codeLabel")}
          </label>
          <input
            id="otp-code"
            type="text"
            required
            autoComplete="one-time-code"
            placeholder={t("codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded border px-3 py-3 text-center text-xl font-mono tracking-widest
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">{t("expiry")}</p>
        </div>

        <button
          type="submit"
          disabled={loading || code.trim().length === 0}
          className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white
                     hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? t("verifying") : t("submitButton")}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        <Link href={ROUTES.login} className="text-blue-600 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-white" />}>
          <VerifyForm />
        </Suspense>
      </div>
    </main>
  );
}
