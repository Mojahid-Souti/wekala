import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth check will be added when middleware is wired up.
  // For now, the layout wraps authenticated pages.
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white px-6 py-4">
        <span className="text-lg font-bold tracking-tight">Wekala</span>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
