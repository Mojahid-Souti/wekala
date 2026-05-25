"use client";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { CommandPaletteProvider } from "@/components/app/command-palette";
import { SidebarProvider, useSidebar } from "@/components/app/sidebar-context";
import { WalkthroughProvider } from "@/components/app/walkthrough";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ToastProvider } from "@/lib/toast";
import { cn } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthGuard>
        <WorkspaceProvider>
          <SidebarProvider>
            <CommandPaletteProvider>
              <WalkthroughProvider>
                <Shell>{children}</Shell>
              </WalkthroughProvider>
            </CommandPaletteProvider>
          </SidebarProvider>
        </WorkspaceProvider>
      </AuthGuard>
    </ToastProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-white">
      <AppSidebar />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out",
          collapsed ? "ml-[64px]" : "ml-[256px]"
        )}
      >
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
