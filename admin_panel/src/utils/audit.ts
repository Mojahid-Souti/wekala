import type { AuditEvent } from "@/types/api";

export type AuditFilters = {
  search: string; // free text across action / resource / actor / outcome
  actor: string; // actor_user_id, or "" for all
  action: string; // exact action, or "" for all
  from: string; // "YYYY-MM-DD" inclusive, or ""
  to: string; // "YYYY-MM-DD" inclusive, or ""
};

export const EMPTY_FILTERS: AuditFilters = {
  search: "",
  actor: "",
  action: "",
  from: "",
  to: "",
};

/**
 * Filter audit events by actor, action, date range, and free-text search.
 * Pure (no mutation). Time: O(n) over the events; n = events in the workspace
 * log. The real backend filters server-side via query params on
 * GET /v1/workspaces/{wid}/audit; this mirrors that contract for the mock.
 */
export function filterAuditEvents(
  events: AuditEvent[],
  filters: AuditFilters,
): AuditEvent[] {
  const query = filters.search.trim().toLowerCase();
  const fromMs = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const toMs = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : null;

  return events.filter((event) => {
    if (filters.actor && event.actor_user_id !== filters.actor) return false;
    if (filters.action && event.action !== filters.action) return false;

    const ts = new Date(event.timestamp).getTime();
    if (fromMs !== null && ts < fromMs) return false;
    if (toMs !== null && ts > toMs) return false;

    if (query) {
      const haystack = [
        event.action,
        event.resource_type,
        event.resource_id,
        event.actor_user_id,
        event.outcome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

/** Sorted unique actions present in the log (for the action dropdown). */
export function distinctActions(events: AuditEvent[]): string[] {
  return Array.from(new Set(events.map((event) => event.action))).sort();
}

/** Sorted unique non-null actor ids present in the log (for the actor dropdown). */
export function distinctActors(events: AuditEvent[]): string[] {
  const ids = events
    .map((event) => event.actor_user_id)
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids)).sort();
}
