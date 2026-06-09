"use client";

export const dynamic = "force-dynamic";

import { N8nCanvas } from "@/components/agent/n8n-canvas";
import { useWorkspaces } from "@/components/app/workspace-context";
import { useStudioSession } from "@/lib/use-n8n-session";
import { Loader2, Workflow } from "lucide-react";

export default function WorkflowsPage() {
  const { current } = useWorkspaces();
  const workspaceName = current?.name ?? "Workspace";

  // Mint a per-user studio session before the embedded canvas mounts.
  const { state: sessionState, error: sessionError } = useStudioSession();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-5 py-3">
        <span className="grid size-8 place-items-center rounded-md bg-neutral-100 text-neutral-600">
          <Workflow className="size-4" />
        </span>
        <div>
          <h1 className="text-base font-semibold text-neutral-950">Workflows</h1>
          <p className="text-xs text-neutral-500">
            Build and manage your automations on the canvas.
          </p>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-neutral-50">
        {sessionState === "minting" && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-50">
            <div className="flex items-center gap-3 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              Preparing your workspace…
            </div>
          </div>
        )}
        {sessionState === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-50 p-6">
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-neutral-950">Could not load workflows.</p>
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
