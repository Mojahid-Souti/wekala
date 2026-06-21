import { MOCK_AGENTS, MOCK_AUDIT, MOCK_KPIS } from "@/mock/data";

type KpiCardProps = { label: string; value: string | number };

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Overview</h2>
        <p className="mt-0.5 text-sm text-neutral-500">Last {MOCK_KPIS.range_days} days</p>
      </div>

      {/* KPI grid — grid is block-direction-agnostic; RTL fills columns from inline-start */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Invocations" value={MOCK_KPIS.invocations.toLocaleString()} />
        <KpiCard label="Hours saved" value={MOCK_KPIS.hours_saved} />
        <KpiCard label="Active agents" value={MOCK_KPIS.active_agents} />
        <KpiCard label="p95 latency" value={`${MOCK_KPIS.p95_latency_ms} ms`} />
      </div>

      {/* Agents table */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-neutral-700">Agents</h3>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                {/* text-start = text-align:start; aligns to inline-start in both directions */}
                <th className="px-4 py-3 text-start font-medium">Name</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3 text-start font-medium">Classification</th>
                <th className="px-4 py-3 text-start font-medium">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {MOCK_AGENTS.map((agent) => (
                <tr key={agent.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{agent.name}</td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {agent.status.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">{agent.classification}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-500">v{agent.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent audit events */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-neutral-700">Recent activity</h3>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <ul className="divide-y divide-neutral-100">
            {MOCK_AUDIT.map((event) => (
              // justify-between distributes items across the main axis.
              // In RTL the first item (action) moves to inline-start (right).
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span className="font-medium text-neutral-700">{event.action}</span>
                <span className="shrink-0 tabular-nums text-neutral-400">
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
