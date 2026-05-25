import { ROUTES } from "@/lib/constants";
import { ArrowLeft, LayoutTemplate } from "lucide-react";
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

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
          <LayoutTemplate className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-neutral-950">
          Template library coming soon
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-neutral-500">
          We're curating a starter library of vetted agents — customer support, internal Q&A,
          document summarizers, and more.
        </p>
      </div>
    </div>
  );
}
