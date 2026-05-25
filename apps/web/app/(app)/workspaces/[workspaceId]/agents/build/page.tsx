"use client";

export const dynamic = "force-dynamic";

import { N8nCanvas } from "@/components/agent/n8n-canvas";
import { useWorkspaces } from "@/components/app/workspace-context";
import { getToken } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { ArrowLeft, Loader2, Save, Workflow } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

type Props = { params: Promise<{ workspaceId: string }> };

type SessionState = "minting" | "ready" | "error";

// Module-scoped Promise cache: React 19 StrictMode and rapid component
// remounts can fire the session mint multiple times before the cookie is
// set. Share one in-flight request so n8n's /rest/login rate limit isn't
// tripped by our own dev tooling.
let inFlightMint: Promise<Response> | null = null;
async function sharedMintRequest(token: string): Promise<Response> {
  if (inFlightMint) return inFlightMint;
  inFlightMint = fetch("/api/n8n-session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).finally(() => {
    // Clear after a short grace window so genuine re-mints later still work.
    setTimeout(() => {
      inFlightMint = null;
    }, 2000);
  });
  return inFlightMint;
}

export default function BuildAgentPage({ params }: Props) {
  const { workspaceId } = use(params);
  const { current } = useWorkspaces();
  const workspaceName = current?.name ?? "Workspace";

  // Phase B multi-tenancy: mint a per-user n8n session BEFORE the iframe
  // mounts. The route handler sets an HttpOnly n8n-auth cookie on the
  // response so the iframe loads with this user's private n8n workspace.
  const [sessionState, setSessionState] = useState<SessionState>("minting");
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function mintSession() {
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setSessionState("error");
          setSessionError("You are not signed in.");
        }
        return;
      }
      try {
        // Dedupe: React 19 StrictMode double-invokes effects in dev, which
        // doubles the /api/n8n-session traffic and trips n8n's login rate
        // limit. Share a single in-flight Promise across concurrent calls.
        const res = await sharedMintRequest(token);
        if (!res.ok) {
          const body = await res.clone().text();
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        if (!cancelled) setSessionState("ready");
      } catch (err) {
        if (!cancelled) {
          setSessionState("error");
          setSessionError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    void mintSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={ROUTES.agents(workspaceId)}
            className="grid size-8 place-items-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Back to agents"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-neutral-950">
              <Workflow className="size-4 text-neutral-500" />
              Build agent
            </h1>
            <p className="text-xs text-neutral-500">Untitled agent · Draft</p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          <Save className="size-3.5" />
          Register as agent
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-neutral-50">
        {sessionState === "minting" && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-50">
            <div className="flex items-center gap-3 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              Preparing your private canvas…
            </div>
          </div>
        )}
        {sessionState === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-50 p-6">
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-neutral-950">Could not load the canvas.</p>
              <p className="mt-2 text-xs text-neutral-500">{sessionError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex h-8 items-center rounded-md bg-neutral-950 px-3 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Reload
              </button>
            </div>
          </div>
        )}
        {sessionState === "ready" && <N8nCanvas workspaceName={workspaceName} />}
      </div>
    </div>
  );
}
