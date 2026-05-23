"use client";

import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();

  const navItems = [
    { label: "Overview", href: ROUTES.workspace(workspaceId) },
    { label: "Agents", href: ROUTES.agents(workspaceId) },
    { label: "Knowledge Base", href: ROUTES.knowledgeBase(workspaceId) },
    { label: "Tools", href: ROUTES.tools(workspaceId) },
    { label: "Members", href: ROUTES.workspaceMembers(workspaceId) },
    { label: "Settings", href: ROUTES.workspaceSettings(workspaceId) },
    { label: "Developer", href: ROUTES.workspaceDeveloper(workspaceId) },
  ];

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <aside className="w-56 shrink-0 border-r bg-gray-50 px-3 py-5">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active =
              item.href === ROUTES.workspace(workspaceId)
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
