import type { ComponentType } from "react";
import { FlagIcon, LayoutIcon, UsersIcon } from "@/lib/icons";
import { MembersPage } from "@/pages/MembersPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { ReportsPage } from "@/pages/ReportsPage";

export type Route = {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  Component: ComponentType;
};

export const ROUTES: Route[] = [
  { path: "/", label: "Overview", icon: LayoutIcon, Component: OverviewPage },
  { path: "/reports", label: "Reports", icon: FlagIcon, Component: ReportsPage },
  { path: "/members", label: "Members", icon: UsersIcon, Component: MembersPage },
];

const FALLBACK = ROUTES[0];

export function resolveRoute(path: string): Route {
  return ROUTES.find((r) => r.path === path) ?? FALLBACK;
}
