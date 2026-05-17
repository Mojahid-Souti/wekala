"use client";

import type { AgentVersionOut } from "@/lib/api";
import { useTranslations } from "next-intl";

type Props = {
  versions: AgentVersionOut[];
  onRollback: (versionNum: number) => void;
  isRollingBack: boolean;
};

export function VersionList({ versions, onRollback, isRollingBack }: Props) {
  const t = useTranslations("agent.detail");

  if (versions.length === 0) {
    return <p className="text-sm text-gray-500">No versions yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {versions.map((v) => (
        <li
          key={v.id}
          className="flex items-center justify-between rounded-md border bg-gray-50 px-4 py-3"
        >
          <div>
            <span className="text-sm font-medium text-gray-800">v{v.version_num}</span>
            {v.change_note && <span className="ml-2 text-xs text-gray-500">{v.change_note}</span>}
            <p className="text-xs text-gray-400">{new Date(v.created_at).toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={() => onRollback(v.version_num)}
            disabled={isRollingBack}
            className="rounded bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("rollbackButton")}
          </button>
        </li>
      ))}
    </ol>
  );
}
