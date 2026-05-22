import { AuthGuard } from "@/components/auth/auth-guard";
import { LogoutButton } from "@/components/auth/logout-button";
import { ROUTES } from "@/lib/constants";
import { ToastProvider } from "@/lib/toast";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");
  return (
    <ToastProvider>
      <AuthGuard>
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <Link
                  href={ROUTES.dashboard}
                  className="text-lg font-bold tracking-tight text-gray-900 hover:text-indigo-600"
                >
                  Wekala
                </Link>
                <nav className="flex gap-4 text-sm text-gray-600">
                  <Link href={ROUTES.dashboard} className="hover:text-gray-900">
                    {t("dashboard")}
                  </Link>
                  <Link href={ROUTES.bazaar} className="hover:text-gray-900">
                    {t("bazaar")}
                  </Link>
                </nav>
              </div>
              <LogoutButton label={t("signOut")} />
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </AuthGuard>
    </ToastProvider>
  );
}
