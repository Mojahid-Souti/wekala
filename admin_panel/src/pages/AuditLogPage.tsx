import { useMemo, useState } from "react";
import { AuditFilters } from "@/components/AuditFilters";
import { AuditTable } from "@/components/AuditTable";
import { MOCK_AUDIT, MOCK_MEMBERS } from "@/mock/data";
import {
  type AuditFilters as Filters,
  distinctActions,
  distinctActors,
  EMPTY_FILTERS,
  filterAuditEvents,
} from "@/utils/audit";

const PAGE_SIZE = 20; // platform default list page size

/**
 * Audit-log viewer (AD5): a searchable, filterable history of workspace actions.
 * Filter (O(n)) → sort newest-first (O(n log n)) → paginate. The real backend
 * paginates server-side and returns AuditLogPage; here we slice the mock.
 */
export function AuditLogPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  // O(1) actor-name lookup; null actor renders as "System".
  const memberNameById = useMemo(
    () =>
      new Map(
        MOCK_MEMBERS.map((member) => [
          member.user_id,
          member.full_name || member.email || member.user_id,
        ]),
      ),
    [],
  );
  const actorName = (id: string | null) =>
    id ? (memberNameById.get(id) ?? id) : "System";

  // Dropdown options derived from the data itself.
  const actorOptions = useMemo(
    () => distinctActors(MOCK_AUDIT).map((id) => ({ id, name: actorName(id) })),
    // actorName depends only on the static member map, so deps are stable.
    // biome-ignore lint/correctness/useExhaustiveDependencies: actorName is derived from a stable map
    [],
  );
  const actionOptions = useMemo(() => distinctActions(MOCK_AUDIT), []);

  const filtered = useMemo(() => {
    const matches = filterAuditEvents(MOCK_AUDIT, filters);
    return matches.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [filters]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleChange(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1); // any filter change resets to the first page
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="font-semibold text-neutral-900 text-xl tracking-tight">Audit log</h1>
        <p className="text-neutral-500 text-sm">{total} events</p>
      </div>

      <AuditFilters
        filters={filters}
        actorOptions={actorOptions}
        actionOptions={actionOptions}
        onChange={handleChange}
        onReset={handleReset}
      />

      <AuditTable events={pageItems} actorName={actorName} />

      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-neutral-500">
            Page {safePage} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-neutral-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
