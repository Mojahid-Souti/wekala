import { AdminLayout } from "@/components/layout/AdminLayout";
import { useHashRoute } from "@/hooks/useHashRoute";
import { resolveRoute } from "@/lib/nav";
import { SettingsPage } from "@/pages/SettingsPage";

export function App() {
  const path = useHashRoute();

  // Settings lives outside ROUTES so the sidebar can pin it at the bottom.
  // Everything else resolves through the ROUTES table (falls back to Overview).
  let content: React.ReactNode;
  if (path === "/settings") {
    content = <SettingsPage />;
  } else {
    const { Component: Page } = resolveRoute(path);
    content = <Page />;
  }

  return <AdminLayout currentPath={path}>{content}</AdminLayout>;
}
