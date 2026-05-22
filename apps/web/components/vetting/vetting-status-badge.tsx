type Status = "unvetted" | "scanning" | "ready_for_review" | "approved" | "rejected" | "failed";

const STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  unvetted: { bg: "bg-gray-100", text: "text-gray-700", label: "Unvetted" },
  scanning: { bg: "bg-amber-50", text: "text-amber-800", label: "Scanning…" },
  ready_for_review: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    label: "Ready for review",
  },
  approved: { bg: "bg-green-50", text: "text-green-800", label: "Approved" },
  rejected: { bg: "bg-red-50", text: "text-red-800", label: "Rejected" },
  failed: { bg: "bg-red-100", text: "text-red-900", label: "Scan failed" },
};

export function VettingStatusBadge({ status }: { status: string }) {
  const s = STYLES[status as Status] ?? STYLES.unvetted;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

const SEV_STYLE: Record<string, string> = {
  info: "bg-gray-100 text-gray-700",
  low: "bg-yellow-50 text-yellow-800",
  medium: "bg-orange-50 text-orange-800",
  high: "bg-red-50 text-red-800",
  critical: "bg-red-100 text-red-900 ring-1 ring-red-300",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
        SEV_STYLE[severity] ?? SEV_STYLE.info
      }`}
    >
      {severity}
    </span>
  );
}
