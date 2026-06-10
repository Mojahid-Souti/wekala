// Public layout for the legal pages (no auth gate). Centered prose column.
import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-neutral-950">
            Wekala
          </Link>
          <nav className="flex gap-4 text-sm text-neutral-500">
            <Link href="/legal/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-neutral-900">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Draft — pending legal review. This document summarizes how Wekala handles data under
          Oman's Personal Data Protection Law (RD 6/2022) and is not yet a finalized legal notice.
        </div>
        <article className="prose-legal mt-8">{children}</article>
      </main>
    </div>
  );
}
