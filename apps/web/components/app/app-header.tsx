"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useIsMac } from "@/lib/use-platform";
import { Bell, PanelLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo } from "react";
import { useCommandPalette } from "./command-palette";
import { useSidebar } from "./sidebar-context";

type Crumb = { label: string; href?: string };

const STATIC_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  bazaar: "Bazaar",
  hired: "Hired agents",
  workspaces: "Workspaces",
  agents: "Agents",
  "knowledge-base": "Knowledge base",
  tools: "Tools",
  "command-center": "Command Center",
  members: "Members",
  settings: "Settings",
  developer: "Developer",
  danger: "Danger zone",
  vetting: "Vetting",
  "mcp-servers": "MCP servers",
  new: "New",
  upload: "Upload",
};

function buildBreadcrumb(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard" }];

  const crumbs: Crumb[] = [];
  let href = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    href += `/${seg}`;
    if (seg === "workspaces" && segments[i + 1]) continue;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg);
    const label = isUuid
      ? "Workspace"
      : (STATIC_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));
    crumbs.push({
      label,
      href: i === segments.length - 1 ? undefined : href,
    });
  }
  return crumbs;
}

export function AppHeader() {
  const { toggle } = useSidebar();
  const { setOpen } = useCommandPalette();
  const pathname = usePathname();
  const isMac = useIsMac();
  const crumbs = useMemo(() => buildBreadcrumb(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur-sm">
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="grid size-8 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
      >
        <PanelLeft className="size-4" />
      </button>

      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {c.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open search"
          data-tour="search"
          className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 md:flex"
        >
          <Search className="size-4 text-neutral-400" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="flex items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open search"
          className="grid size-9 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 md:hidden"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Bell className="size-4" />
        </button>
      </div>
    </header>
  );
}
