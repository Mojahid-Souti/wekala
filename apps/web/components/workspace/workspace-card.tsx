import { ROUTES } from "@/lib/constants";
import Link from "next/link";

type Workspace = { id: string; name: string; slug: string; description?: string };

export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <Link href={ROUTES.workspace(workspace.id)} className="block group">
      <div className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
        <h2 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
          {workspace.name}
        </h2>
        <p className="text-xs text-gray-400 mt-1">{workspace.slug}</p>
        {workspace.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">{workspace.description}</p>
        )}
      </div>
    </Link>
  );
}
