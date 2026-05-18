"use client";

import { HireButton } from "@/components/bazaar/hire-button";
import { RatingStars } from "@/components/bazaar/rating-stars";
import type { BazaarAgentOut } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";

type Props = {
  agent: BazaarAgentOut;
  workspaceId: string;
  token: string;
  onUnhire?: () => void;
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  public: "bg-green-50 text-green-700",
  internal: "bg-blue-50 text-blue-700",
  restricted: "bg-yellow-50 text-yellow-700",
  confidential: "bg-red-50 text-red-700",
};

export function BazaarAgentCard({ agent, workspaceId, token, onUnhire }: Props) {
  const rating = agent.rating;

  return (
    <div className="flex flex-col justify-between rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <Link
            href={ROUTES.bazaarAgent(agent.id)}
            className="text-base font-semibold text-gray-900 hover:text-indigo-600"
          >
            {agent.name}
          </Link>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              CLASSIFICATION_COLORS[agent.classification] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {agent.classification}
          </span>
        </div>
        <p className="mb-3 line-clamp-2 text-sm text-gray-600">{agent.description}</p>
        {agent.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {agent.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {rating && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <RatingStars value={rating.avg ?? 0} readonly />
            {rating.avg !== null ? (
              <span>
                {rating.avg.toFixed(1)} ({rating.count})
              </span>
            ) : (
              <span>({rating.count} reviews)</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-400">v{agent.version}</span>
        <HireButton
          agentId={agent.id}
          workspaceId={workspaceId}
          token={token}
          initialHired={agent.hired}
          onToggle={onUnhire}
        />
      </div>
    </div>
  );
}
