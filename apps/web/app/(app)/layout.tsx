import { ROUTES } from "@/lib/constants";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");
  // Server-side auth check will be added when middleware is wired up.
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold tracking-tight">Wekala</span>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href={ROUTES.dashboard} className="hover:text-gray-900">
              {t("dashboard")}
            </Link>
            <Link href={ROUTES.dashboard} className="hover:text-gray-900">
              {t("agents")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
