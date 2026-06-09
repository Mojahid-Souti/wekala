"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ROUTES } from "@/lib/constants";
import { useIsMac } from "@/lib/use-platform";
import {
  BarChart3,
  BookOpen,
  Home,
  Settings,
  Sparkles,
  Store,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWorkspaces } from "./workspace-context";

type CmdkContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const CmdkContext = createContext<CmdkContextValue | null>(null);

export function useCommandPalette(): CmdkContextValue {
  const ctx = useContext(CmdkContext);
  if (!ctx) throw new Error("useCommandPalette must be used inside CommandPaletteProvider");
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isMac = useIsMac();
  const { workspaces, current } = useWorkspaces();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Some keydown events (IME composition, password-manager autofill) carry
      // no `key` — guard before calling string methods on it.
      if (e.key?.toLowerCase() !== "k") return;
      if (isMac ? !e.metaKey : !e.ctrlKey) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMac]);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router]
  );

  const value = useMemo(() => ({ open, setOpen }), [open]);

  const currentWs = current ?? workspaces[0] ?? null;

  return (
    <CmdkContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => go(ROUTES.dashboard)} className="gap-2.5">
              <Home className="size-4 text-neutral-500" />
              Home
            </CommandItem>
            <CommandItem onSelect={() => go(ROUTES.bazaar)} className="gap-2.5">
              <Store className="size-4 text-neutral-500" />
              Bazaar
            </CommandItem>
            {currentWs && (
              <>
                <CommandItem onSelect={() => go(ROUTES.agents(currentWs.id))} className="gap-2.5">
                  <Sparkles className="size-4 text-neutral-500" />
                  Agents
                </CommandItem>
                <CommandItem
                  onSelect={() => go(ROUTES.knowledgeBase(currentWs.id))}
                  className="gap-2.5"
                >
                  <BookOpen className="size-4 text-neutral-500" />
                  Knowledge base
                </CommandItem>
                <CommandItem onSelect={() => go(ROUTES.tools(currentWs.id))} className="gap-2.5">
                  <Wrench className="size-4 text-neutral-500" />
                  Tools
                </CommandItem>
                <CommandItem
                  onSelect={() => go(ROUTES.workflows(currentWs.id))}
                  className="gap-2.5"
                >
                  <Workflow className="size-4 text-neutral-500" />
                  Workflows
                </CommandItem>
                <CommandItem
                  onSelect={() => go(ROUTES.commandCenter(currentWs.id))}
                  className="gap-2.5"
                >
                  <BarChart3 className="size-4 text-neutral-500" />
                  Dashboard
                </CommandItem>
                <CommandItem
                  onSelect={() => go(ROUTES.workspaceMembers(currentWs.id))}
                  className="gap-2.5"
                >
                  <Users className="size-4 text-neutral-500" />
                  Members
                </CommandItem>
                <CommandItem
                  onSelect={() => go(ROUTES.workspaceSettings(currentWs.id))}
                  className="gap-2.5"
                >
                  <Settings className="size-4 text-neutral-500" />
                  Workspace settings
                </CommandItem>
              </>
            )}
          </CommandGroup>

          {workspaces.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Workspaces">
                {workspaces.map((ws) => (
                  <CommandItem
                    key={ws.id}
                    onSelect={() => go(ROUTES.workspace(ws.id))}
                    className="gap-3"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-neutral-900 text-[11px] font-semibold text-white">
                      {ws.name.charAt(0).toUpperCase()}
                    </span>
                    {ws.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </CmdkContext.Provider>
  );
}
