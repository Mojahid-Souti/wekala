import { LOCALES } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex rounded-lg border border-neutral-200 bg-white p-1">
      {LOCALES.map((option) => {
        const active = option.id === locale;
        const className = active
          ? "rounded-md px-4 py-1.5 text-sm font-medium transition-colors bg-neutral-900 text-white"
          : "rounded-md px-4 py-1.5 text-sm transition-colors text-neutral-600 hover:bg-neutral-100";
        return (
          <button key={option.id} type="button" role="radio" aria-checked={active} onClick={() => setLocale(option.id)} className={className}>
            {option.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}