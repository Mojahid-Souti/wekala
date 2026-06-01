"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Code2,
  FileUp,
  Heart,
  Home,
  LayoutTemplate,
  LifeBuoy,
  List,
  Pencil,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountMenu } from "./account-menu";
import { useSidebar } from "./sidebar-context";
import { useWorkspaces } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

type NavLeaf = {
  kind: "leaf";
  href: string;
  icon: typeof Home;
  label: string;
  exact?: boolean;
  disabled?: boolean;
  tour?: string;
};

type NavParent = {
  kind: "parent";
  href: string;
  icon: typeof Home;
  label: string;
  tour?: string;
  disabled?: boolean;
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavParent;

type NavGroup = {
  label: string;
  items: NavItem[];
};

function useNavGroups(workspaceId: string | null): NavGroup[] {
  return useMemo(() => {
    const ws = workspaceId;
    const leaf = (
      href: (id: string) => string,
      icon: typeof Home,
      label: string,
      tour?: string
    ): NavLeaf =>
      ws
        ? { kind: "leaf", href: href(ws), icon, label, tour }
        : { kind: "leaf", href: "#", icon, label, disabled: true, tour };

    return [
      {
        label: "Platform",
        items: [
          { kind: "leaf", href: ROUTES.dashboard, icon: Home, label: "Home", exact: true },
          ws
            ? {
                kind: "parent",
                href: ROUTES.agents(ws),
                icon: Sparkles,
                label: "Agents",
                tour: "agents",
                children: [
                  {
                    kind: "leaf",
                    href: ROUTES.agents(ws),
                    icon: List,
                    label: "All agents",
                    exact: true,
                  },
                  { kind: "leaf", href: ROUTES.agentsBuild(ws), icon: Pencil, label: "Build" },
                  {
                    kind: "leaf",
                    href: ROUTES.agentsTemplates(ws),
                    icon: LayoutTemplate,
                    label: "Templates",
                  },
                  {
                    kind: "leaf",
                    href: ROUTES.agentsImport(ws),
                    icon: FileUp,
                    label: "Import",
                  },
                ],
              }
            : {
                kind: "leaf",
                href: "#",
                icon: Sparkles,
                label: "Agents",
                disabled: true,
                tour: "agents",
              },
          leaf(ROUTES.knowledgeBase, BookOpen, "Knowledge base", "knowledge-base"),
          leaf(ROUTES.tools, Wrench, "Tools"),
          leaf(ROUTES.commandCenter, BarChart3, "Dashboard", "dashboard"),
        ],
      },
      {
        label: "Marketplace",
        items: [
          { kind: "leaf", href: ROUTES.bazaar, icon: Store, label: "Bazaar", tour: "bazaar" },
          { kind: "leaf", href: ROUTES.hired, icon: Heart, label: "My hired agents" },
        ],
      },
      {
        label: "Admin",
        items: ws
          ? [
              {
                kind: "parent",
                href: ROUTES.workspaceSettings(ws),
                icon: Settings,
                label: "Settings",
                children: [
                  {
                    kind: "leaf",
                    href: ROUTES.workspaceSettings(ws),
                    icon: SlidersHorizontal,
                    label: "General",
                    exact: true,
                  },
                  {
                    kind: "leaf",
                    href: ROUTES.workspaceMembers(ws),
                    icon: Users,
                    label: "Members",
                  },
                  {
                    kind: "leaf",
                    href: ROUTES.workspaceDeveloper(ws),
                    icon: Code2,
                    label: "Developer",
                  },
                ],
              },
            ]
          : [],
      },
    ];
  }, [workspaceId]);
}

export function AppSidebar() {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const { currentId } = useWorkspaces();
  const groups = useNavGroups(currentId);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-neutral-200 bg-white transition-[width] duration-300 ease-in-out",
          collapsed ? "w-[64px]" : "w-[256px]"
        )}
        data-collapsed={collapsed}
      >
        {/* Brand row — same height as header so dividers align */}
        <div className="flex h-14 items-center border-b border-neutral-200 px-3">
          <Link
            href={ROUTES.dashboard}
            className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-neutral-950 text-sm font-bold text-white">
              W
            </span>
            {!collapsed && (
              <span className="text-base font-semibold tracking-tight text-neutral-950">
                Wekala
              </span>
            )}
          </Link>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 space-y-5 overflow-y-auto p-2">
          {/* WORKSPACE section — just the switcher */}
          <div className="space-y-1.5">
            {!collapsed && (
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Workspace
              </p>
            )}
            <WorkspaceSwitcher collapsed={collapsed} />
          </div>

          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <NavSection
                key={group.label}
                label={group.label}
                items={group.items}
                pathname={pathname}
                collapsed={collapsed}
              />
            )
          )}
        </nav>

        {/* Support / Feedback */}
        <div className="space-y-1 p-2">
          <SidebarLink
            href="#"
            icon={LifeBuoy}
            label="Support"
            active={false}
            collapsed={collapsed}
          />
          <SidebarLink href="#" icon={Send} label="Feedback" active={false} collapsed={collapsed} />
        </div>

        {/* Account */}
        <div className="border-t border-neutral-200 p-2">
          <AccountMenu collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavSection({
  label,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </p>
      )}
      {items.map((item) => {
        if (item.kind === "leaf") {
          const active = item.exact
            ? pathname === item.href
            : item.href !== "#" && pathname.startsWith(item.href);
          return (
            <SidebarLink
              key={item.label}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={active}
              collapsed={collapsed}
              disabled={item.disabled}
              tour={item.tour}
            />
          );
        }
        return (
          <NavParentItem key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
        );
      })}
    </div>
  );
}

function NavParentItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavParent;
  pathname: string;
  collapsed: boolean;
}) {
  // A child is active when the URL starts with its href, with the "exact" parent
  // route only matching when the path is the parent itself (not a child route).
  const childActive = (child: NavLeaf): boolean => {
    if (child.exact) return pathname === child.href;
    return child.href !== "#" && pathname.startsWith(child.href);
  };
  const parentActive = pathname.startsWith(item.href);
  const hasActiveChild = item.children.some(childActive);
  const [open, setOpen] = useState<boolean>(parentActive);

  useEffect(() => {
    if (parentActive) setOpen(true);
  }, [parentActive]);

  const Icon = item.icon;

  if (collapsed) {
    return (
      <SidebarLink
        href={item.href}
        icon={Icon}
        label={item.label}
        active={parentActive && !hasActiveChild}
        collapsed
        disabled={item.disabled}
        tour={item.tour}
      />
    );
  }

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "group flex h-9 items-center gap-3 rounded-lg pr-1 text-sm font-medium transition-colors",
          parentActive
            ? "text-neutral-950"
            : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
        )}
      >
        <Link
          href={item.href}
          data-tour={item.tour}
          className="flex flex-1 items-center gap-3 rounded-lg px-2 py-1.5"
        >
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
          aria-expanded={open}
          className="grid size-6 place-items-center rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
        >
          <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
        </button>
      </div>
      {open && (
        <div className="ml-3 space-y-0.5 border-l border-neutral-200 pl-3">
          {item.children.map((child) => (
            <SubItemLink
              key={child.label}
              href={child.href}
              icon={child.icon}
              label={child.label}
              active={childActive(child)}
              disabled={child.disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubItemLink({
  href,
  icon: Icon,
  label,
  active,
  disabled,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  active: boolean;
  disabled?: boolean;
}) {
  const className = cn(
    "flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors",
    disabled
      ? "cursor-not-allowed text-neutral-400 opacity-60"
      : active
        ? "bg-neutral-100 font-semibold text-neutral-950"
        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
  );
  if (disabled) {
    return (
      <div className={className} aria-disabled="true">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    );
  }
  return (
    <Link href={href} data-active={active} className={className}>
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  disabled,
  tour,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  active: boolean;
  collapsed: boolean;
  disabled?: boolean;
  tour?: string;
}) {
  const inner = (
    <>
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  const baseClass = cn(
    "group flex h-9 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
    collapsed && "justify-center px-0"
  );

  const stateClass = disabled
    ? "cursor-not-allowed text-neutral-400 opacity-60"
    : active
      ? "bg-neutral-100 text-neutral-950 font-semibold"
      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950";

  const link = disabled ? (
    <div className={cn(baseClass, stateClass)} aria-disabled="true" data-tour={tour}>
      {inner}
    </div>
  ) : (
    <Link href={href} data-active={active} data-tour={tour} className={cn(baseClass, stateClass)}>
      {inner}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="bg-neutral-950 text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
