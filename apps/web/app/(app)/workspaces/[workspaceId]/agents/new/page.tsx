"use client";

export const dynamic = "force-dynamic";

import { ImportYamlForm } from "@/components/agent/import-yaml-form";
import { TemplateGrid } from "@/components/agent/template-grid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { DIFY_STUDIO_URL, ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Download,
  ExternalLink,
  FileUp,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useState } from "react";

type Props = { params: Promise<{ workspaceId: string }> };

const TABS = ["template", "upload", "dify"] as const;

export default function NewAgentPage({ params }: Props) {
  const { workspaceId } = use(params);
  const requested = useSearchParams().get("tab") ?? "";
  const tab = (TABS as readonly string[]).includes(requested) ? requested : "template";
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-5 py-6 lg:px-7">
      <header className="space-y-3">
        <Link
          href={ROUTES.agents(workspaceId)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Agents
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">New agent</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Start from a template, import a Dify YAML, or build visually on the canvas.
          </p>
        </div>
      </header>

      <Tabs defaultValue={tab}>
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-neutral-200">
          <TabsTrigger value="template" className="flex-none gap-1.5">
            <LayoutTemplate className="size-4" /> From template
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-none gap-1.5">
            <FileUp className="size-4" /> Upload YAML
          </TabsTrigger>
          <TabsTrigger value="dify" className="flex-none gap-1.5">
            <Workflow className="size-4" /> Build in Dify
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="pt-4">
          <TemplateGrid workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="upload" className="pt-4">
          <ImportYamlForm workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="dify" className="pt-4">
          <BuildInDify workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BuildInDify({ workspaceId }: { workspaceId: string }) {
  const token = useToken();
  const { toast } = useToast();
  const router = useRouter();
  const [importing, setImporting] = useState<string | null>(null);

  const {
    data: apps,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["dify-apps", workspaceId],
    queryFn: () => api.agents.difyApps(workspaceId, token),
    enabled: !!token,
  });

  async function handleImport(appId: string) {
    setImporting(appId);
    try {
      const agent = await api.agents.importFromDify(workspaceId, appId, token);
      toast("Imported as a draft agent — vet it before publishing.", "info");
      router.push(ROUTES.agentDetail(workspaceId, agent.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
      setImporting(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Step 1 — build it in Dify */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
            <Workflow className="size-4" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-950">Step 1 · Build it in Dify</h3>
            <p className="mt-0.5 text-sm text-neutral-500">
              Design your app — prompts, model, and tools — in the Dify studio, then come back here
              to import it.
            </p>
            <Button asChild variant="outline" className="mt-3">
              <a href={DIFY_STUDIO_URL} target="_blank" rel="noreferrer noopener">
                Open Dify Studio
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2 — import the app you built */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
              <Download className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-neutral-950">Step 2 · Import from Dify</h3>
              <p className="mt-0.5 text-sm text-neutral-500">
                Pick the app you built. It imports as a Draft and must pass the gatekeeper before
                publish.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="shrink-0"
          >
            <RefreshCw className={cn("size-3.5", isRefetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
                />
              ))}
            </div>
          ) : isError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Couldn't reach Dify. Make sure the Dify service is running, then refresh.
            </p>
          ) : !apps || apps.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              No Dify apps yet. Build one in the studio, then refresh.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
              {apps.map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {app.name || "Untitled"}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {app.mode}
                      {app.description ? ` · ${app.description}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleImport(app.id)}
                    disabled={importing !== null}
                    className="shrink-0"
                  >
                    {importing === app.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="size-3.5" />
                    )}
                    Import
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Apps come from the shared Dify workspace (POC); the imported agent lands in this
          workspace.
        </p>
      </div>
    </div>
  );
}
