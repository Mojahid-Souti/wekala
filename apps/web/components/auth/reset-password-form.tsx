"use client";

import { AuthBrandMark, AuthFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, CheckIcon, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

const RESEND_COOLDOWN_S = 60;

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function sendReset(addr: string) {
    setError("");
    setLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${ROUTES.newPassword}`
          : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setSent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await sendReset(email.trim());
  }

  if (sent) {
    return (
      <AuthPageShell>
        <div className="flex flex-1 flex-col justify-center space-y-7">
          <div className="flex flex-col items-center space-y-4 text-center">
            <AuthBrandMark />
            <div className="grid size-16 place-items-center rounded-full bg-emerald-50">
              <CheckIcon className="size-7 text-emerald-600" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
                {t("sentTitle")}
              </h1>
              <p className="text-sm text-neutral-500">
                {t("sentMessage")} <span className="font-medium text-neutral-900">{email}</span>
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 text-center text-sm text-neutral-600">
            <p>{t("didntReceive")}</p>
            <button
              type="button"
              disabled={loading || cooldown > 0}
              onClick={() => sendReset(email)}
              className="font-medium text-neutral-950 underline underline-offset-4 hover:no-underline disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
            >
              {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resendLink")}
            </button>
          </div>

          <BackToSignIn label={t("backToLogin")} />
        </div>
        <AuthFooter />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <div className="flex flex-1 flex-col justify-center space-y-7">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AuthBrandMark />
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
            <p className="text-sm text-neutral-500">{t("subtitle")}</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
            >
              <Mail className="size-4" />
            </span>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={t("emailLabel")}
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm text-neutral-950 placeholder:text-neutral-400 transition-colors focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading || email.trim() === ""}
            className="group relative mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 text-base font-medium text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_-8px_rgba(0,0,0,0.4)] transition-all hover:bg-neutral-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-950"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submitButton")
            )}
          </button>
        </form>

        <BackToSignIn label={t("backToLogin")} />
      </div>
      <AuthFooter />
    </AuthPageShell>
  );
}

function BackToSignIn({ label }: { label: string }) {
  return (
    <Link
      href={ROUTES.login}
      className="inline-flex items-center justify-center gap-1.5 text-center text-sm font-medium text-neutral-600 hover:text-neutral-950"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
