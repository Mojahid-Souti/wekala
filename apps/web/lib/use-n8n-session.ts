// Mints a per-user studio session (sets the HttpOnly auth cookie) before the
// embedded studio iframe loads. Shared by the Build and Workflows pages so a
// single in-flight request is reused (the backend login is rate-limited).
"use client";

import { getToken } from "@/lib/auth-storage";
import { useEffect, useState } from "react";

export type StudioSessionState = "minting" | "ready" | "error";

// Module-scoped Promise cache: React 19 StrictMode and rapid remounts can fire
// the mint multiple times before the cookie is set. Share one in-flight request.
let inFlightMint: Promise<Response> | null = null;
async function sharedMintRequest(token: string): Promise<Response> {
  if (inFlightMint) return inFlightMint;
  inFlightMint = fetch("/api/n8n-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).finally(() => {
    setTimeout(() => {
      inFlightMint = null;
    }, 2000);
  });
  return inFlightMint;
}

export function useStudioSession(): { state: StudioSessionState; error: string | null } {
  const [state, setState] = useState<StudioSessionState>("minting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function mint() {
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setState("error");
          setError("You are not signed in.");
        }
        return;
      }
      try {
        const res = await sharedMintRequest(token);
        if (!res.ok) {
          const body = await res.clone().text();
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        if (!cancelled) setState("ready");
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    void mint();
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, error };
}
