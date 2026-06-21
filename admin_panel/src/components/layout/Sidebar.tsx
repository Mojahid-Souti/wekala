import { FlagIcon, GearIcon } from "@/lib/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { TranslationKey } from "@/lib/i18n/config";
import { ROUTES } from "@/lib/nav";

// Maps route paths to their sidebar label translation keys.
// Kept here (not in nav.tsx) so nav.tsx stays a pure routing table.
function navLabelKey(path: string): TranslationKey {
  if (path === "/reports") return "nav.reports";
  if (path === "/members") return "nav.members";
  return "nav.overview";
}

type SidebarProps = {
  currentPath: string;
};

// Logical classes keep the sidebar on the inline-start side in both LTR and RTL:
//   start-0       = inset-inline-start: 0  (left in LTR, right in RTL)
//   border-e      = border-inline-end       (right border in LTR, left in RTL)
//   ps-5 / pe-3   = padding-inline-start/end
// The flex-direction:row of nav items naturally reverses in RTL so icon stays
// at inline-start and label follows — no extra classes needed for that.
export function Sidebar({ currentPath }: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="fixed inset-y-0 start-0 z-20 flex w-60 flex-col border-e border-neutral-200 bg-white">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center border-b border-neutral-200 ps-5 pe-3">
        <span className="truncate text-sm font-semibold tracking-tight text-neutral-900">
          {t("app.title")}
        </span>
      </div>

      {/* Main navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {ROUTES.map((route) => {
            const active = currentPath === route.path;
            const Icon = route.icon;
            return (
              <li key={route.path}>
                <a
                  href={`#${route.path}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-neutral-900 font-medium text-white"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  {/* FlagIcon has a directional shape; mirror it in RTL. */}
                  <Icon
                    className={`h-4 w-4 shrink-0${Icon === FlagIcon ? " transition-transform rtl:-scale-x-100" : ""}`}
                  />
                  <span>{t(navLabelKey(route.path))}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Settings link pinned at the bottom */}
      <div className="shrink-0 border-t border-neutral-200 p-2">
        <a
          href="#/settings"
          aria-current={currentPath === "/settings" ? "page" : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            currentPath === "/settings"
              ? "bg-neutral-900 font-medium text-white"
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          }`}
        >
          <GearIcon className="h-4 w-4 shrink-0" />
          <span>{t("nav.settings")}</span>
        </a>
      </div>
    </aside>
  );
}
