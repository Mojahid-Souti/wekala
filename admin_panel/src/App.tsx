import { SettingsPage } from "@/pages/SettingsPage";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function App() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-neutral-200 border-b bg-white px-6 py-4">
        <h1 className="font-semibold text-lg tracking-tight">{t("app.title")}</h1>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <SettingsPage />
      </main>
    </div>
  );
}