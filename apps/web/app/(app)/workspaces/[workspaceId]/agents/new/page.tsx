"use client";

export const dynamic = "force-dynamic";

import { ImportYamlForm } from "@/components/agent/import-yaml-form";
import { TemplateGrid } from "@/components/agent/template-grid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/constants";
import { ArrowRight, FileUp, LayoutTemplate, Workflow } from "lucide-react";
import Link from "next/link";
import { use } from "react";

type Props = { params: Promise<{ workspaceId: string }> };

export default function NewAgentPage({ params }: Props) {
  const { workspaceId } = use(params);
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

      <Tabs defaultValue="template">
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
  return (
    <div className="max-w-2xl space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-700">
          <Workflow className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-neutral-950">Build visually on the canvas</h3>
          <p className="mt-0.5 text-sm text-neutral-500">
            Design nodes, prompts, and flows on the embedded canvas, then register the result as an
            agent.
          </p>
        </div>
      </div>
      <Button asChild>
        <Link href={ROUTES.agentsBuild(workspaceId)}>
          Open the canvas
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
      <p className="text-xs text-neutral-400">
        One-click round-trip import from a standalone Dify app lands in Phase 15.
      </p>
    </div>
  );
}
