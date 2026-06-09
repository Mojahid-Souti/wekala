"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Workflow } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkflowsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["n8n-workflows", workspaceId],
    queryFn: () => api.n8n.workflows(token),
    enabled: !!token,
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-5 py-6 lg:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Workflows</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Your n8n automations, inside Wekala. Build and edit them on the embedded studio.
          </p>
        </div>
        <Button asChild>
          <Link href={ROUTES.agentsBuild(workspaceId)}>
            <Workflow className="size-4" /> Open n8n studio
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-neutral-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <div className="size-9 animate-pulse rounded-lg bg-neutral-100" />
                <div className="h-4 w-48 animate-pulse rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        ) : workflows && workflows.length > 0 ? (
          <ul className="divide-y divide-neutral-100">
            {workflows.map((wf) => (
              <li key={wf.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                    <Workflow className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {wf.name || "Untitled workflow"}
                    </p>
                    {wf.updated_at && (
                      <p className="text-xs text-neutral-400">
                        Updated {new Date(wf.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    wf.active ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-500"
                  )}
                >
                  {wf.active ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <Workflow className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-neutral-900">No workflows yet</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Open the n8n studio to create your first automation.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={ROUTES.agentsBuild(workspaceId)}>
                Open n8n studio <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
