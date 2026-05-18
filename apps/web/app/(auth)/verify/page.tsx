"use client";

export const dynamic = "force-dynamic";
import { ROUTES } from "@/lib/constants";
import { useTranslations } from "next-intl";
import Link from "next/link";

export default function VerifyPage() {
  const t = useTranslations("auth.verify");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">{t("title")}</h1>
        <p className="text-gray-600 mb-6">{t("message")}</p>
        <Link href={ROUTES.login} className="text-sm text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
