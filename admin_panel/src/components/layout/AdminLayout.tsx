import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

type AdminLayoutProps = {
  currentPath: string;
  children: ReactNode;
};

// ps-60 = padding-inline-start: 240px.
// In LTR this pushes content right of the left sidebar.
// In RTL this pushes content left of the right sidebar.
export function AdminLayout({ currentPath, children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Sidebar currentPath={currentPath} />
      <div className="ps-60">
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
