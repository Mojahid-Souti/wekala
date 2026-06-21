import type { AuditFilters as Filters } from "@/utils/audit";

type AuditFiltersProps = {
  filters: Filters;
  actorOptions: { id: string; name: string }[];
  actionOptions: string[];
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
};

const FIELD = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-neutral-400 focus:outline-none";
const LABEL = "mb-1 block text-neutral-500 text-xs font-medium";

export function AuditFilters({
  filters,
  actorOptions,
  actionOptions,
  onChange,
  onReset,
}: AuditFiltersProps) {
  const hasActiveFilter =
    filters.search !== "" ||
    filters.actor !== "" ||
    filters.action !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={LABEL} htmlFor="audit-search">
            Search
          </label>
          <input
            id="audit-search"
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="action, resource, actor…"
            className={`${FIELD} w-full`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="audit-actor">
            Actor
          </label>
          <select
            id="audit-actor"
            value={filters.actor}
            onChange={(e) => onChange({ actor: e.target.value })}
            className={`${FIELD} w-full`}
          >
            <option value="">All actors</option>
            {actorOptions.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="audit-action">
            Action
          </label>
          <select
            id="audit-action"
            value={filters.action}
            onChange={(e) => onChange({ action: e.target.value })}
            className={`${FIELD} w-full`}
          >
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="audit-from">
            From
          </label>
          <input
            id="audit-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => onChange({ from: e.target.value })}
            className={`${FIELD} w-full`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="audit-to">
            To
          </label>
          <input
            id="audit-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => onChange({ to: e.target.value })}
            className={`${FIELD} w-full`}
          />
        </div>
      </div>

      {hasActiveFilter && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg px-3 py-1.5 font-medium text-neutral-500 text-sm hover:bg-neutral-100 hover:text-neutral-700"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
