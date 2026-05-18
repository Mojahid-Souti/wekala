"use client";

import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  agentId: string;
  workspaceId: string;
  token: string;
  initialHired: boolean;
  onToggle?: () => void;
};

export function HireButton({ agentId, workspaceId, token, initialHired, onToggle }: Props) {
  const t = useTranslations("bazaar.agent");
  const [hired, setHired] = useState(initialHired);

  const hireMut = useMutation({
    mutationFn: () => api.hires.hire(workspaceId, agentId, token),
    onSuccess: () => {
      setHired(true);
      onToggle?.();
    },
  });

  const unhireMut = useMutation({
    mutationFn: () => api.hires.unhire(workspaceId, agentId, token),
    onSuccess: () => {
      setHired(false);
      onToggle?.();
    },
  });

  const loading = hireMut.isPending || unhireMut.isPending;

  if (hired) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => unhireMut.mutate()}
        className="rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
      >
        {loading ? "…" : `✓ ${t("hiredButton")}`}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => hireMut.mutate()}
      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {loading ? "…" : t("hireButton")}
    </button>
  );
}
