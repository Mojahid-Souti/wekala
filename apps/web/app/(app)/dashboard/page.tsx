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
    <div className="max-w-5xl px-6 py-8">
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">{t("title")}</h1>
            <Link
              href={ROUTES.newWorkspace}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              {t("createButton")}
            </Link>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-8 w-8 text-indigo-600"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to Wekala</h1>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        Workspaces are how teams organize agents, knowledge bases, and members. Create your first
        one to get started.
      </p>
      <Link
        href={ROUTES.newWorkspace}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shadow-sm"
      >
        Create your first workspace
      </Link>
    </div>
  );
}
