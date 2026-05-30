import { ImportYamlForm } from "@/components/agent/import-yaml-form";
import { ROUTES } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Props = { params: Promise<{ workspaceId: string }> };

export default async function ImportAgentPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 px-5 py-6 lg:px-7">
      <header className="space-y-1.5">
        <Link
          href={ROUTES.agents(workspaceId)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="size-3.5" />
          Agents
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Import a YAML</h1>
        <p className="text-sm text-neutral-500">
          Upload an existing Dify agent definition to register it in this workspace.
        </p>
      </header>

      <ImportYamlForm workspaceId={workspaceId} />
    </div>
  );
}
