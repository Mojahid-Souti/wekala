import type { Route } from "@/lib/nav";

type SidebarProps = {
  routes: Route[];
  currentPath: string;
  onNavigate?: () => void;
};

export function Sidebar({ routes, currentPath, onNavigate }: SidebarProps) {
  return (
    <nav className="flex h-full flex-col p-3" aria-label="Admin navigation">
      <div className="px-3 py-4">
        <span className="font-semibold text-neutral-900 text-sm tracking-tight">Sila</span>
        <span className="ms-1.5 text-neutral-400 text-sm">Admin</span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {routes.map((route) => {
          const Icon = route.icon;
          const active = route.path === currentPath;
          const className = active
            ? "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors bg-neutral-900 text-white"
            : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900";
          return (
            <li key={route.path}>
              <a href={`#${route.path}`} aria-current={active ? "page" : undefined} onClick={() => onNavigate?.()} className={className}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {route.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}