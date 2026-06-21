import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useHashRoute } from "@/hooks/useHashRoute";
import { MenuIcon } from "@/lib/icons";
import { ROUTES, resolveRoute } from "@/lib/nav";

export function AdminLayout() {
  const { path } = useHashRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
  const route = resolveRoute(path);
  const Screen = route.Component;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 hidden w-60 border-neutral-200 border-e bg-white md:block">
        <Sidebar routes={ROUTES} currentPath={route.path} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-neutral-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-60 border-neutral-200 border-e bg-white">
            <Sidebar
              routes={ROUTES}
              currentPath={route.path}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="md:ps-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-neutral-200 border-b bg-white/80 px-4 py-3 backdrop-blur md:px-8">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <h1 className="font-semibold text-base tracking-tight">{route.label}</h1>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Screen />
        </main>
      </div>
    </div>
  );
}