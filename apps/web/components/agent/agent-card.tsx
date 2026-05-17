import type { AgentOut } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { AgentStatusBadge } from "./agent-status-badge";

type Props = {
  agent: AgentOut;
  workspaceId: string;
};

export function AgentCard({ agent, workspaceId }: Props) {
  return (
    <Link
      href={ROUTES.agentDetail(workspaceId, agent.id)}
      className="block rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-base font-semibold text-gray-900">{agent.name}</h3>
        <AgentStatusBadge status={agent.status} />
      </div>
      {agent.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{agent.description}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        <span>v{agent.version}</span>
        <span>·</span>
        <span>{agent.classification}</span>
        {agent.tags.length > 0 && (
          <>
            <span>·</span>
            <span>{agent.tags.slice(0, 3).join(", ")}</span>
          </>
        )}
      </div>
    </Link>
  );
}
