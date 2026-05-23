"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ROUTES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { CheckIcon, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const OTP_LENGTH = 6;

export function VerifyForm() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submittedRef = useRef<string>("");

  const verify = useCallback(
    async (otp: string) => {
      if (!email) {
        setError(t("noEmail"));
        return;
      }
      if (submittedRef.current === otp) return;
      submittedRef.current = otp;
      setError("");
      setLoading(true);
      try {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: "signup",
        });
        if (verifyError) throw verifyError;
        setDone(true);
        await supabase.auth.signOut();
        setTimeout(() => router.push(ROUTES.login), 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.includes("expired") || msg.includes("invalid") ? t("invalidCode") : msg);
        setCode("");
        submittedRef.current = "";
      } finally {
        setLoading(false);
      }
    },
    [email, router, t]
  );

  useEffect(() => {
    if (code.length === OTP_LENGTH && !loading && !done) {
      void verify(code);
    }
  }, [code, loading, done, verify]);

  if (done) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-6 text-center">
        <BrandMark />
        <div className="grid size-16 place-items-center rounded-full bg-emerald-50">
          <CheckIcon className="size-8 text-emerald-600" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            {t("successTitle")}
          </h1>
          <p className="text-sm text-neutral-500">{t("successMessage")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[88vh] flex-col">
      <div className="flex flex-1 flex-col justify-center space-y-7">
        <div className="flex flex-col items-center space-y-4 text-center">
          <BrandMark />
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
            <p className="text-sm text-neutral-500">
              {t("message")}{" "}
              {email && <span className="font-medium text-neutral-900">{email}</span>}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === OTP_LENGTH) void verify(code);
          }}
          className="flex flex-col items-center space-y-5"
        >
          <InputOTP
            maxLength={OTP_LENGTH}
            value={code}
            onChange={(v) => setCode(v.replace(/\D/g, ""))}
            autoFocus
            disabled={loading}
            aria-label={t("codeLabel")}
          >
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <InputOTPSlot key={`otp-${["a", "b", "c", "d", "e", "f"][i]}`} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              {t("verifying")}
            </div>
          )}

          <p className="text-center text-xs text-neutral-400">{t("expiry")}</p>
        </form>

        <p className="text-center text-sm text-neutral-600">
          <Link
            href={ROUTES.login}
            className="font-medium text-neutral-950 underline underline-offset-4 hover:no-underline"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </div>

      <Footer />
    </div>
  );
}

function BrandMark() {
  return (
    <div className="grid size-14 place-items-center rounded-2xl bg-neutral-950 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_20px_-6px_rgba(0,0,0,0.3)]">
      <span className="text-xl font-bold">W</span>
    </div>
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
