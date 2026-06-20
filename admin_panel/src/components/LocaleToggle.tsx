import { useEffect, useState } from "react";

export type Locale = "en" | "ar";

const STORAGE_KEY = "sila.admin.locale";
const RTL_LOCALES = new Set<Locale>(["ar"]);

function readSavedLocale(): Locale {
  return localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
}

/**
 * Lightweight EN/AR switch — a demo harness for L6 so the Arabic webfont can be
 * verified now. Real i18n / locale management is L4's job; this only sets
 * <html lang/dir> (and persists the choice), which is exactly what the
 * locale-scoped font rules in index.css key off. L4 can replace this component
 * without touching the font wiring.
 */
export function LocaleToggle() {
  const [locale, setLocale] = useState<Locale>(readSavedLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  return (
    <div
      className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5"
      role="group"
      aria-label="Language"
    >
      {(["en", "ar"] as const).map((value) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLocale(value)}
            aria-pressed={active}
            className={`rounded-md px-3 py-1 font-medium text-sm transition-colors ${
              active
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {value === "en" ? "English" : "العربية"}
          </button>
        );
      })}
    </div>
  );
}
