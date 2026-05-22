"use client";

import { ROUTES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Inverse of AuthGuard: for /login, /signup, /verify, /reset-password.
 * If the user already has a session, redirect them to the dashboard.
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "guest">("checking");

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (token) {
      router.replace(ROUTES.dashboard);
      return;
    }
    setStatus("guest");
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
