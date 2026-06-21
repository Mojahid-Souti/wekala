import type { ComponentType, FC, SVGProps } from "react";

export type Route = {
  path: string;
  label: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  Component: ComponentType;
};

// Placeholder stubs — AdminLayout is not currently rendered by App.tsx.
// Replace with real page imports when AD1 (admin layout) is integrated.
function PlaceholderPage(): null {
  return null;
}

function PlaceholderIcon(_props: SVGProps<SVGSVGElement>): null {
  return null;
}

export const ROUTES: Route[] = [
  { path: "/", label: "Overview", icon: PlaceholderIcon, Component: PlaceholderPage },
  { path: "/reports", label: "Reports", icon: PlaceholderIcon, Component: PlaceholderPage },
  { path: "/members", label: "Members", icon: PlaceholderIcon, Component: PlaceholderPage },
  { path: "/settings", label: "Settings", icon: PlaceholderIcon, Component: PlaceholderPage },
];

export function resolveRoute(path: string): Route {
  return ROUTES.find((r) => r.path === path) ?? (ROUTES[0] as Route);
}
