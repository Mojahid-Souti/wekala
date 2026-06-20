/**
 * Admin Panel shell — wires in the screens. Add pages under src/pages/,
 * components under src/components/, hooks under src/hooks/.
 */
import { DashboardPage } from "@/pages/DashboardPage";

export function App() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-neutral-200 border-b bg-white px-6 py-4">
        <h1 className="font-semibold text-lg tracking-tight">Sila · Admin Panel</h1>
        <p className="text-neutral-500 text-sm">
          Standalone work area. Build your assigned screen here; it gets integrated into
          the main app later.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <DashboardPage />
      </main>
    </div>
  );
}
