"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { ROUTES } from "@/lib/constants";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

type TabDef = { value: string; label: string; href: (wid: string) => string; adminOnly: boolean };

const TABS: TabDef[] = [
  { value: "general", label: "General", href: ROUTES.workspaceSettings, adminOnly: false },
  { value: "members", label: "Members", href: ROUTES.workspaceMembers, adminOnly: true },
  { value: "developer", label: "Developer", href: ROUTES.workspaceDeveloper, adminOnly: true },
  { value: "danger", label: "Danger zone", href: ROUTES.workspaceDanger, adminOnly: true },
];

function tabFromPath(pathname: string): string {
  if (pathname.endsWith("/settings/members")) return "members";
  if (pathname.endsWith("/settings/developer")) return "developer";
  if (pathname.endsWith("/settings/danger")) return "danger";
  return "general";
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useWorkspaceRole(workspaceId);

  const current = tabFromPath(pathname);

  // Defense-in-depth UX: a non-admin who deep-links to an admin-only tab is
  // bounced to General once the role resolves. The server (OPA + RLS) is the
  // real boundary — this just avoids a dead-end screen. Never act while the
  // role is still loading, or we'd bounce an admin off their own tab on reload.
  useEffect(() => {
    if (loading) return;
    const tab = TABS.find((t) => t.value === current);
    if (tab?.adminOnly && !isAdmin) {
      router.replace(ROUTES.workspaceSettings(workspaceId));
    }
  }, [loading, isAdmin, current, workspaceId, router]);

  // While the role is unknown, show only the always-safe tab so admin-only tabs
  // never flash to a viewer.
  const visibleTabs = TABS.filter((t) => !t.adminOnly || (isAdmin && !loading));

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-5 py-6 lg:px-7">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Settings</h1>
        <p className="text-sm text-neutral-500">
          Manage your workspace, members, and integrations.
        </p>
      </header>

      <Tabs
        value={current}
        onValueChange={(v) => {
          const tab = TABS.find((t) => t.value === v);
          if (tab) router.push(tab.href(workspaceId));
        }}
      >
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-neutral-200">
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-none">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {children}
    </div>
  );
}
