import type { AuditEvent } from "@/types/api";
import { formatDateTime } from "@/utils/format";

type AuditTableProps = {
  events: AuditEvent[];
  actorName: (id: string | null) => string;
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const className =
    outcome === "success"
      ? "bg-green-100 text-green-800"
      : outcome === "failure"
        ? "bg-red-100 text-red-700"
        : "bg-neutral-100 text-neutral-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${className}`}>
      {outcome}
    </span>
  );
}

function ResourceCell({ event }: { event: AuditEvent }) {
  if (!event.resource_type && !event.resource_id) return <span className="text-neutral-400">—</span>;
  return (
    <span className="text-neutral-600">
      {event.resource_type ?? "—"}
      {event.resource_id ? (
        <span className="text-neutral-400"> · {event.resource_id}</span>
      ) : null}
    </span>
  );
}

export function AuditTable({ events, actorName }: AuditTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-neutral-100 border-b bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <th className="px-4 py-2.5 font-medium">Time</th>
            <th className="px-4 py-2.5 font-medium">Actor</th>
            <th className="px-4 py-2.5 font-medium">Action</th>
            <th className="px-4 py-2.5 font-medium">Resource</th>
            <th className="px-4 py-2.5 font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-neutral-500">
                No audit events match these filters.
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr key={event.id} className="border-neutral-100 border-b last:border-0 hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">
                  {formatDateTime(event.timestamp)}
                </td>
                <td className="px-4 py-2.5 text-neutral-800">{actorName(event.actor_user_id)}</td>
                <td className="px-4 py-2.5">
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700 text-xs">
                    {event.action}
                  </code>
                </td>
                <td className="px-4 py-2.5">
                  <ResourceCell event={event} />
                </td>
                <td className="px-4 py-2.5">
                  <OutcomeBadge outcome={event.outcome} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
