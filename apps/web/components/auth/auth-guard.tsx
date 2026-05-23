"use client";

import { getToken } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    if (!getToken()) {
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
