import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-lg tracking-tight">{t("settings.title")}</h2>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="font-medium text-neutral-900 text-sm">{t("settings.language.label")}</h3>
        <p className="mt-1 text-neutral-500 text-sm">{t("settings.language.description")}</p>
        <div className="mt-3"><LanguageSwitcher /></div>
        <p className="mt-3 text-neutral-400 text-xs">{t("settings.saved")}</p>
      </section>
    </div>
  );
}