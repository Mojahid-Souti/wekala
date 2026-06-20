const CARDS = [
  { path: "/reports", title: "Reports queue", description: "Review and resolve what users have reported." },
  { path: "/members", title: "Members", description: "Manage workspace members and their roles." },
] as const;

export function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg tracking-tight">Overview</h2>
        <p className="mt-1 text-neutral-500 text-sm">
          Welcome to the Sila admin area. Choose a section from the sidebar to begin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <a key={card.path} href={`#${card.path}`} className="rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
            <p className="font-medium text-neutral-900 text-sm">{card.title}</p>
            <p className="mt-1 text-neutral-500 text-sm">{card.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}