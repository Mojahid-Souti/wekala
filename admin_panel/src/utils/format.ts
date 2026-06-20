/** Format an ISO timestamp for display, e.g. "Jun 20, 2026, 1:37 PM".
 * Returns an em dash for null/invalid input so callers can render it directly. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
