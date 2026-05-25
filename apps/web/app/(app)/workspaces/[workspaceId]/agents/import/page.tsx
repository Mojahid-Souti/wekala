import { ROUTES } from "@/lib/constants";
import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";

type Props = { params: Promise<{ workspaceId: string }> };

export default async function ImportAgentPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-7 px-5 py-6 lg:px-7">
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

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
          <FileUp className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-neutral-950">
          Drag-and-drop import coming soon
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-neutral-500">
          The polished import flow is on the way. For now, use the classic form to upload a YAML
          file (size limit 1MB, schema validated server-side).
        </p>
        <Link
          href={ROUTES.newAgent(workspaceId)}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Use the classic form
        </Link>
      </div>
    </div>
  );
}
