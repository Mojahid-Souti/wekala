"use client";

import { ROUTES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Client-side guard for protected routes.
 * Reads sessionStorage on mount; if no token, redirects to /login.
 * Renders children only after a token is confirmed present.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      router.replace(ROUTES.login);
      return;
    }
    setStatus("authed");
  }, [router]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
