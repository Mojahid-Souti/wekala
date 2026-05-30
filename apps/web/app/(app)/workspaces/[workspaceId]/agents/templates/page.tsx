import { TemplateGrid } from "@/components/agent/template-grid";
import { ROUTES } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Props = { params: Promise<{ workspaceId: string }> };

export default async function TemplatesPage({ params }: Props) {
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
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Pick a template</h1>
        <p className="text-sm text-neutral-500">
          Start from a vetted starting point and customize it for your team.
        </p>
      </header>

      <TemplateGrid workspaceId={workspaceId} />
    </div>
  );
}
