"use client";

import { AuthBrandMark, AuthFooter, AuthPageShell } from "@/components/auth/auth-page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/lib/constants";
import { scorePassword } from "@/lib/password-strength";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { ArrowLeft, CheckIcon, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function NewPasswordForm() {
  const t = useTranslations("auth.newPassword");
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [sessionReady, setSessionReady] = useState<"checking" | "ok" | "missing">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSessionReady(data.session ? "ok" : "missing");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);

  const passwordError = password.length > 0 && password.length < 12 ? t("passwordTooShort") : "";
  const confirmError =
    touchedConfirm && confirm.length > 0 && confirm !== password ? t("passwordMismatch") : "";

  const submitDisabled =
    loading || password.length < 12 || confirm !== password || sessionReady !== "ok";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      await supabase.auth.signOut();
      toast(t("successToast"), "success");
      setTimeout(() => router.push(ROUTES.login), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthPageShell>
        <div className="flex flex-1 flex-col items-center justify-center space-y-6 text-center">
          <AuthBrandMark />
          <div className="grid size-16 place-items-center rounded-full bg-emerald-50">
            <CheckIcon className="size-7 text-emerald-600" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              {t("successTitle")}
            </h1>
            <p className="text-sm text-neutral-500">{t("successMessage")}</p>
          </div>
        </div>
        <AuthFooter />
      </AuthPageShell>
    );
  }

  if (sessionReady === "missing") {
    return (
      <AuthPageShell>
        <div className="flex flex-1 flex-col items-center justify-center space-y-6 text-center">
          <AuthBrandMark />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              {t("noSessionTitle")}
            </h1>
            <p className="text-sm text-neutral-500">{t("noSessionMessage")}</p>
          </div>
          <Link
            href={ROUTES.resetPassword}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-6 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {t("requestNewLink")}
          </Link>
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
          <div className="space-y-2">
            <PasswordInput
              id="password"
              icon={<Lock className="size-4" />}
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
              ariaLabel={t("passwordLabel")}
              invalid={!!passwordError}
              error={passwordError}
            />
            {password.length > 0 && (
              <StrengthMeter
                score={strength.score}
                weakLabel={t("strengthWeak")}
                fairLabel={t("strengthFair")}
                strongLabel={t("strengthStrong")}
                veryStrongLabel={t("strengthVeryStrong")}
              />
            )}
          </div>

          <PasswordInput
            id="confirm-password"
            icon={<Lock className="size-4" />}
            placeholder={t("confirmPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setTouchedConfirm(true)}
            show={showConfirm}
            onToggle={() => setShowConfirm((v) => !v)}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            ariaLabel={t("confirmLabel")}
            invalid={!!confirmError}
            error={confirmError}
          />

          <button
            type="submit"
            disabled={submitDisabled}
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

        <Link
          href={ROUTES.login}
          className="inline-flex items-center justify-center gap-1.5 text-center text-sm font-medium text-neutral-600 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          {t("backToLogin")}
        </Link>
      </div>
      <AuthFooter />
    </AuthPageShell>
  );
}

type PasswordInputProps = {
  id: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  show: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  ariaLabel: string;
  invalid: boolean;
  error: string;
};

function PasswordInput({
  id,
  icon,
  placeholder,
  value,
  onChange,
  onBlur,
  show,
  onToggle,
  showLabel,
  hideLabel,
  ariaLabel,
  invalid,
  error,
}: PasswordInputProps) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
        >
          {icon}
        </span>
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          className={`h-12 w-full rounded-2xl border bg-white pl-11 pr-12 text-sm text-neutral-950 placeholder:text-neutral-400 transition-colors focus:outline-none focus:ring-2 ${
            invalid
              ? "border-red-300 focus:border-red-500 focus:ring-red-100"
              : "border-neutral-200 focus:border-neutral-950 focus:ring-neutral-200"
          }`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={show}
          aria-label={show ? hideLabel : showLabel}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-700"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p className="px-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function StrengthMeter({
  score,
  weakLabel,
  fairLabel,
  strongLabel,
  veryStrongLabel,
}: {
  score: 0 | 1 | 2 | 3 | 4;
  weakLabel: string;
  fairLabel: string;
  strongLabel: string;
  veryStrongLabel: string;
}) {
  const SEGMENTS = ["one", "two", "three", "four"] as const;
  const filled = score === 0 ? 1 : score;
  const colorClass =
    score <= 1
      ? "bg-red-500"
      : score === 2
        ? "bg-amber-500"
        : score === 3
          ? "bg-emerald-500"
          : "bg-emerald-600";
  const label =
    score <= 1 ? weakLabel : score === 2 ? fairLabel : score === 3 ? strongLabel : veryStrongLabel;
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex flex-1 gap-1" aria-hidden>
        {SEGMENTS.map((id, i) => (
          <span
            key={id}
            className={`h-1 flex-1 rounded-full ${i < filled ? colorClass : "bg-neutral-200"}`}
          />
        ))}
      </div>
      <span className="w-20 text-right text-xs text-neutral-500">{label}</span>
    </div>
  );
}
