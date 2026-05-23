import { BrandPanel } from "./brand-panel";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="grid min-h-screen lg:grid-cols-2">
        <main className="flex items-center justify-center bg-white px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <BrandPanel />
      </div>
    </div>
  );
}
