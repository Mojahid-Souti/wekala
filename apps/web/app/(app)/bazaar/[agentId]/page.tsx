"use client";

import { HireButton } from "@/components/bazaar/hire-button";
import { RatingStars } from "@/components/bazaar/rating-stars";
import { ReviewForm } from "@/components/bazaar/review-form";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

// Workspace / token come from session in full implementation
const WORKSPACE_ID = "";
const TOKEN = "";

type Props = { params: { agentId: string } };

export default function BazaarAgentDetailPage({ params }: Props) {
  const { agentId } = params;
  const t = useTranslations("bazaar");
  const qc = useQueryClient();
  const [reviewPage, setReviewPage] = useState(1);

  const { data: agent, isLoading } = useQuery({
    queryKey: ["bazaar-agent", agentId, WORKSPACE_ID],
    queryFn: () => api.bazaar.get(agentId, WORKSPACE_ID, TOKEN),
    enabled: !!TOKEN,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["bazaar-reviews", agentId, reviewPage],
    queryFn: () => api.bazaar.reviews(agentId, TOKEN, reviewPage),
    enabled: !!TOKEN,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-100" />
        <div className="h-24 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!agent) return <p className="text-sm text-gray-500">Agent not found.</p>;

  const rating = agent.rating;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
          <p className="mt-1 text-sm text-gray-600">{agent.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <HireButton
          agentId={agentId}
          workspaceId={WORKSPACE_ID}
          token={TOKEN}
          initialHired={agent.hired}
          onToggle={() => qc.invalidateQueries({ queryKey: ["bazaar-agent", agentId] })}
        />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-6 rounded-lg border p-4 text-sm">
        <div>
          <span className="font-medium text-gray-700">{t("agent.classification")}: </span>
          <span className="capitalize text-gray-600">{agent.classification}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">{t("agent.version")}: </span>
          <span className="text-gray-600">v{agent.version}</span>
        </div>
        <div className="flex items-center gap-2">
          {rating && rating.count >= 1 ? (
            <>
              <RatingStars value={rating.avg ?? 0} readonly />
              <span className="text-gray-500">
                {rating.avg !== null ? rating.avg.toFixed(1) : "—"} ({rating.count}{" "}
                {t("agent.ratingCount", { count: rating.count })})
              </span>
            </>
          ) : (
            <span className="text-gray-400">{t("agent.noRatings")}</span>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("review.title")}</h2>

        <ReviewForm
          agentId={agentId}
          workspaceId={WORKSPACE_ID}
          token={TOKEN}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["bazaar-reviews", agentId] });
            qc.invalidateQueries({ queryKey: ["bazaar-agent", agentId] });
          }}
        />

        {reviewsLoading && <div className="mt-4 h-20 animate-pulse rounded bg-gray-100" />}

        {!reviewsLoading && reviews && reviews.items.length === 0 && (
          <p className="mt-4 text-sm text-gray-500">{t("review.empty")}</p>
        )}

        {reviews && reviews.items.length > 0 && (
          <ul className="mt-4 space-y-4">
            {reviews.items.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2">
                  <RatingStars value={r.rating} readonly />
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.body && <p className="text-sm text-gray-700">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}

        {reviews && reviews.total > reviews.items.length && (
          <button
            type="button"
            onClick={() => setReviewPage((p) => p + 1)}
            className="mt-4 text-sm text-indigo-600 hover:underline"
          >
            {t("review.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}
