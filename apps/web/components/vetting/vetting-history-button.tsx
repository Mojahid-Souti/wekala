"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { VettingRunOut } from "@/lib/api";
import { History } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_PREFIX = "wekala.vetting.history.lastSeen.";

export function VettingHistoryButton({
  runs,
  agentId,
}: {
  runs: VettingRunOut[];
  agentId: string;
}) {
  const [open, setOpen] = useState(false);
  // Hydration-safe: start as null so SSR + first client render agree, then
  // read from localStorage in an effect.
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  useEffect(() => {
    setLastSeenAt(window.localStorage.getItem(STORAGE_PREFIX + agentId));
  }, [agentId]);

  // Past runs only — the *latest* run is surfaced via the main page UI.
  const past = runs.slice(1);
  if (past.length === 0) return null;

  // Unread = past runs started after the user's last "seen" timestamp. Before
  // the user opens the sheet even once, everything is unread.
  const unreadCount = lastSeenAt
    ? past.filter((r) => r.started_at > lastSeenAt).length
    : past.length;

  function handleOpen() {
    setOpen(true);
    // Stamp "seen" using the newest past run's started_at — anything older
    // counts as already-read.
    const newest = past[0]?.started_at;
    if (newest) {
      window.localStorage.setItem(STORAGE_PREFIX + agentId, newest);
      setLastSeenAt(newest);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={
          unreadCount > 0 ? `Show vetting history — ${unreadCount} unread` : "Show vetting history"
        }
        className="relative grid size-10 place-items-center rounded-md border border-neutral-300 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
      >
        <History className="size-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white"
            aria-hidden
          >
            {unreadCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full max-w-md gap-0 p-0">
          <SheetHeader className="border-b border-neutral-100 px-5 py-4">
            <SheetTitle>Vetting history</SheetTitle>
            <SheetDescription>Past scan runs for this agent — most recent first.</SheetDescription>
          </SheetHeader>
          <ol className="divide-y divide-neutral-100 overflow-y-auto">
            {past.map((r) => {
              const dt = new Date(r.started_at);
              const total = r.finding_summary?.total ?? 0;
              const sev = r.finding_summary?.by_severity ?? {};
              return (
                <li key={r.id} className="px-5 py-4 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-neutral-900">{dt.toLocaleString()}</span>
                    <span className="text-xs uppercase tracking-wider text-neutral-500">
                      {(r.outcome ?? r.status).replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                    <span>{total} findings</span>
                    {(sev.critical ?? 0) > 0 && (
                      <span className="font-mono text-neutral-700">{sev.critical} critical</span>
                    )}
                    {(sev.high ?? 0) > 0 && (
                      <span className="font-mono text-neutral-700">{sev.high} high</span>
                    )}
                    {(sev.medium ?? 0) > 0 && (
                      <span className="font-mono text-neutral-700">{sev.medium} medium</span>
                    )}
                    {(sev.low ?? 0) > 0 && (
                      <span className="font-mono text-neutral-700">{sev.low} low</span>
                    )}
                  </div>
                  {r.approval_note && (
                    <p className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                      &ldquo;{r.approval_note}&rdquo;
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </SheetContent>
      </Sheet>
    </>
  );
}
