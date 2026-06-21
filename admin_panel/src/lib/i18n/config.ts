export type Locale = "en" | "ar";

export type TranslationKey =
  | "app.title"
  | "nav.overview"
  | "nav.reports"
  | "nav.members"
  | "nav.settings"
  | "settings.title"
  | "settings.language.label"
  | "settings.language.description"
  | "settings.saved";

export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    "app.title": "Sila · Admin Panel",
    "nav.overview": "Overview",
    "nav.reports": "Reports",
    "nav.members": "Members",
    "nav.settings": "Settings",
    "settings.title": "Settings",
    "settings.language.label": "Language",
    "settings.language.description": "Choose the language for the admin interface.",
    "settings.saved": "Your language preference is saved on this device.",
  },
  ar: {
    "app.title": "صِلة · لوحة الإدارة",
    "nav.overview": "نظرة عامة",
    "nav.reports": "التقارير",
    "nav.members": "الأعضاء",
    "nav.settings": "الإعدادات",
    "settings.title": "الإعدادات",
    "settings.language.label": "اللغة",
    "settings.language.description": "اختر لغة واجهة الإدارة.",
    "settings.saved": "تم حفظ تفضيل اللغة على هذا الجهاز.",
  },
};

export const LOCALES: ReadonlyArray<{ id: Locale; nativeLabel: string }> = [
  { id: "en", nativeLabel: "English" },
  { id: "ar", nativeLabel: "العربية" },
];
