"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Inbox, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * An inbox-style trigger that sits in the page header. When the reviewer
 * has something to act on (latest run completed and ready_for_review), the
 * icon shows a red dot and pulses three times to draw attention — then sits
 * still until clicked. Clicking opens a centred Dialog with the alert text,
 * audit-log note, and Reject / Approve buttons.
 *
 * Pulse is a CSS animation with `animation-iteration-count: 3` so it never
 * loops indefinitely; we don't need to remember "I've pulsed once" via state
 * because the same animation re-fires only when the runId prop changes
 * (which happens after a fresh scan).
 */
export function VettingDecisionInbox({
  runId,
  blocked,
  criticalCount,
  note,
  onNoteChange,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  runId: string;
  blocked: boolean;
  criticalCount: number;
  note: string;
  onNoteChange: (s: string) => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Track which runId the reviewer has already opened. The badge clears once
  // they've seen the current run — a fresh scan flips `runId` and re-shows it.
  const [seenRunId, setSeenRunId] = useState<string | null>(null);
  const isSeen = seenRunId === runId;

  // Re-key the pulse animation when runId changes — runId is the intentional
  // trigger even though the body doesn't read it.
  const [animKey, setAnimKey] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runId is an intentional re-fire trigger.
  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [runId]);

  // Auto-close the dialog once a decision settles. Without this, the dialog
  // stays open after the toast fires, and a fast clicker can fire the
  // mutation again — and again, and again — producing N toasts for N clicks.
  // One decision per open = one toast.
  const wasPending = useRef(false);
  useEffect(() => {
    const pending = approving || rejecting;
    if (wasPending.current && !pending) setOpen(false);
    wasPending.current = pending;
  }, [approving, rejecting]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSeenRunId(runId);
        }}
        aria-label={
          blocked
            ? `Review action pending — ${criticalCount} critical findings`
            : "Review action pending"
        }
        className="relative grid size-10 place-items-center rounded-md border border-neutral-300 bg-white text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
      >
        <Inbox className="size-4" />
        {/* One inbox = one pending decision. The badge is a single dot, not
            a finding count — clicking it resolves the action; the count
            never decrements, so showing N would be misleading. */}
        {!isSeen && (
          <span
            key={animKey}
            className="vetting-inbox-pulse absolute -right-0.5 -top-0.5 block size-2.5 rounded-full bg-neutral-900 ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle>{blocked ? "Approval blocked" : "Awaiting your decision"}</DialogTitle>
                <DialogDescription className="mt-0.5">
                  {blocked
                    ? `${criticalCount} critical finding${criticalCount === 1 ? "" : "s"} cannot be approved away.`
                    : "Approve to allow publishing, or reject to send back to Draft."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {blocked && (
            <p className="text-sm text-neutral-600">
              Edit the agent to remove the flagged content and resubmit, or reject to send the agent
              back to Draft.
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="vetting-note"
                className="text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                Audit-log note
              </label>
              <span className="text-[10px] text-neutral-400">
                Optional · recorded for compliance
              </span>
            </div>
            <textarea
              id="vetting-note"
              rows={3}
              placeholder="Why are you approving / rejecting?"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="block w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50/60 px-3.5 py-2.5 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onReject}
              disabled={rejecting || approving}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
            >
              {rejecting && <Loader2 className="size-3.5 animate-spin" />}
              {rejecting ? "Rejecting…" : "Reject"}
            </button>
            {!blocked && (
              <button
                type="button"
                onClick={onApprove}
                disabled={approving || rejecting}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {approving && <Loader2 className="size-3.5 animate-spin" />}
                {approving ? "Approving…" : "Approve"}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
