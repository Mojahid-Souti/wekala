"use client";

export const dynamic = "force-dynamic";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";

type Workspace = { id: string; name: string; slug: string };

export default function DashboardPage() {
  const t = useTranslations("workspace.dashboard");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (!token) return;
    api.workspaces.list(token).then((data) => {
      setWorkspaces(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link
          href={ROUTES.newWorkspace}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("createButton")}
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <p className="text-gray-500">{t("empty")}</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
        </div>
      )}
    </div>
  );
}
