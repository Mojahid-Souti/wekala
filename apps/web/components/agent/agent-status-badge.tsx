import { clsx } from "clsx";
import { useTranslations } from "next-intl";

type AgentStatus = "draft" | "in_review" | "published" | "archived";

const STATUS_STYLES: Record<AgentStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-700",
};

export function AgentStatusBadge({ status }: { status: string }) {
  const t = useTranslations("agent.status");
  const style = STATUS_STYLES[status as AgentStatus] ?? "bg-gray-100 text-gray-700";
  const label = t(status as AgentStatus, { fallback: status });

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        style
      )}
    >
      {label}
    </span>
  );
}
