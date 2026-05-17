type Workspace = { id: string; name: string; slug: string };

export function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <h2 className="font-semibold text-gray-900 truncate">{workspace.name}</h2>
      <p className="text-xs text-gray-400 mt-1">{workspace.slug}</p>
    </div>
  );
}
