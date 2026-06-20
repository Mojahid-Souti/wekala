import type { AgentReport } from "@/types/api";

type ReportStatus = AgentReport["status"];

// Colour + label per report status. Keyed by string since the API type allows
// any string; unknown values fall back to a neutral pill showing the raw value.
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800" },
  reviewing: { label: "Reviewing", className: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800" },
  dismissed: { label: "Dismissed", className: "bg-neutral-200 text-neutral-700" },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const style = STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-neutral-100 text-neutral-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs ${style.className}`}
    >
      {style.label}
    </span>
  );
}
