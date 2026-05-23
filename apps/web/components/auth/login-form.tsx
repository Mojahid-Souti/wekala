"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { setTokens } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
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
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api.auth.login(email, password);
      setTokens(session.access_token, session.refresh_token, { remember });
      router.push(ROUTES.dashboard);
    } catch {
      setError(te("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled = loading || email.trim() === "" || password === "";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-[88vh] flex-col">
        <div className="flex flex-1 flex-col justify-center space-y-7">
          <div className="flex flex-col items-center space-y-4 text-center">
            <BrandMark />
            <div className="space-y-1.5">
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
                {t("title")}
              </h1>
              <p className="text-sm text-neutral-500">{t("subtitle")}</p>
            </div>
          </div>

          {expired && !error && (
            <Alert className="border-neutral-300 bg-neutral-50 text-neutral-700">
              <AlertDescription>{t("sessionExpired")}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <IconInput
              id="email"
              type="email"
              icon={<Mail className="size-4" />}
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              ariaLabel={t("emailLabel")}
            />

            <IconInput
              id="password"
              type={showPassword ? "text" : "password"}
              icon={<Lock className="size-4" />}
              required
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ariaLabel={t("passwordLabel")}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  className="text-neutral-400 transition-colors hover:text-neutral-700"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  className="size-4 rounded-md border-neutral-300 data-[state=checked]:border-neutral-950 data-[state=checked]:bg-neutral-950"
                />
                <Label htmlFor="remember" className="text-sm font-normal text-neutral-600">
                  {t("rememberMe")}
                </Label>
              </div>
              <Link
                href={ROUTES.resetPassword}
                className="text-sm font-medium text-neutral-950 hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>

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

          <Divider label={t("orSignInWith")} />

          <div className="grid grid-cols-2 gap-3">
            <SocialButton provider="google" disabledLabel={t("comingSoon")} />
            <SocialButton provider="apple" disabledLabel={t("comingSoon")} />
          </div>

          <p className="pt-2 text-center text-sm text-neutral-600">
            {t("noAccount")}{" "}
            <Link
              href={ROUTES.signup}
              className="font-medium text-neutral-950 underline underline-offset-4 hover:no-underline"
            >
              {t("signUpLink")}
            </Link>
          </p>
        </div>

        <Footer />
      </div>
    </TooltipProvider>
  );
}

function BrandMark() {
  return (
    <div className="grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_20px_-6px_rgba(0,0,0,0.3)]">
      <span className="text-xl font-bold">W</span>
    </div>
  );
}

type IconInputProps = {
  id: string;
  type: string;
  icon: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ariaLabel: string;
  trailing?: React.ReactNode;
};

function IconInput({
  id,
  type,
  icon,
  required,
  autoComplete,
  placeholder,
  value,
  onChange,
  ariaLabel,
  trailing,
}: IconInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
      >
        {icon}
      </span>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-12 text-sm text-neutral-950 placeholder:text-neutral-400 transition-colors focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-200"
      />
      {trailing && <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center">
      <span aria-hidden className="flex-1 border-t border-neutral-200" />
      <span className="px-3 text-xs text-neutral-500">{label}</span>
      <span aria-hidden className="flex-1 border-t border-neutral-200" />
    </div>
  );
}

function SocialButton({
  provider,
  disabledLabel,
}: {
  provider: "google" | "apple";
  disabledLabel: string;
}) {
  const label = provider === "google" ? "Google" : "Apple";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 opacity-70 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          {provider === "google" ? <GoogleIcon /> : <AppleIcon />}
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-neutral-950 text-white">
        {disabledLabel}
      </TooltipContent>
    </Tooltip>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <title>Google</title>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.61 0 3.06.55 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-neutral-950">
      <title>Apple</title>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

function Footer() {
  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-neutral-100 pt-5 text-xs text-neutral-500 sm:flex-row">
      <p>&copy; {new Date().getFullYear()} Wekala. All rights reserved.</p>
      <div className="flex items-center gap-3">
        <a href="/legal/privacy" className="hover:text-neutral-700 hover:underline">
          Privacy Policy
        </a>
        <span aria-hidden>·</span>
        <a href="/legal/terms" className="hover:text-neutral-700 hover:underline">
          Terms &amp; Conditions
        </a>
      </div>
    </div>
  );
}
