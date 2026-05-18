"use client";

import { RatingStars } from "@/components/bazaar/rating-stars";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  agentId: string;
  workspaceId: string;
  token: string;
  onSuccess?: () => void;
};

export function ReviewForm({ agentId, workspaceId, token, onSuccess }: Props) {
  const t = useTranslations("bazaar.review");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");

  const mut = useMutation({
    mutationFn: () => api.bazaar.submitReview(agentId, workspaceId, rating, body, token),
    onSuccess: () => {
      setRating(0);
      setBody("");
      onSuccess?.();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (rating > 0) mut.mutate();
      }}
      className="rounded-lg border p-4"
    >
      <fieldset className="mb-3 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-gray-700">{t("ratingLabel")}</legend>
        <RatingStars value={rating} onChange={setRating} />
      </fieldset>
      <div className="mb-3">
        <label htmlFor="review-body" className="mb-1 block text-sm font-medium text-gray-700">
          {t("bodyLabel")}
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("bodyPlaceholder")}
          maxLength={2000}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      {mut.isError && (
        <p className="mb-2 text-xs text-red-600">
          {t("../../errors.reviewFailed" as "ratingLabel")}
        </p>
      )}
      <button
        type="submit"
        disabled={rating === 0 || mut.isPending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {mut.isPending ? "…" : t("submitButton")}
      </button>
    </form>
  );
}
