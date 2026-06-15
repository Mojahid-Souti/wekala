/**
 * Admin Panel shell — starter. Replace the placeholder with your screens.
 * Add pages under src/pages/, components under src/components/, and route
 * between them however you like (start simple with state; add a router later).
 */
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
        <div className="rounded-xl border border-neutral-200 border-dashed bg-white p-10 text-center">
          <p className="font-medium text-neutral-700">Nothing here yet.</p>
          <p className="mt-1 text-neutral-500 text-sm">
            Start from your task. Reference data shapes live in{" "}
            <code className="rounded bg-neutral-100 px-1">src/types/api.ts</code>, real API routes
            in <code className="rounded bg-neutral-100 px-1">src/lib/endpoints.ts</code>, and mock
            data to build against in <code className="rounded bg-neutral-100 px-1">src/mock/data.ts</code>.
          </p>
        </div>
      </main>
    </div>
  );
}
