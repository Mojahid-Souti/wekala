"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { clearTokens } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { Bell, ChevronsUpDown, Compass, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWalkthrough } from "./walkthrough";

type Me = { id: string; email: string };

export function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const token = useToken();
  const router = useRouter();
  const { toast } = useToast();
  const { start: startTour } = useWalkthrough();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.auth
      .me(token)
      .then((data) => {
        if (!cancelled) setMe(data as Me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const initial = (me?.email ?? "?").charAt(0).toUpperCase();
  const display = me?.email.split("@")[0] ?? "Loading…";
  const email = me?.email ?? "";

  function handleSignOut() {
    clearTokens();
    toast("Signed out.", "info");
    router.replace(ROUTES.login);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
            {initial}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-950">
                  {display}
                </span>
                <span className="block truncate text-xs text-neutral-500">{email}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-neutral-400" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align={collapsed ? "start" : "end"} className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-950">{display}</span>
            <span className="block truncate text-xs font-normal text-neutral-500">{email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5">
          <User className="size-4" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5">
          <Bell className="size-4" />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => startTour()} className="gap-2.5">
          <Compass className="size-4" />
          Take the tour
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="gap-2.5 text-red-600 focus:text-red-700"
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
