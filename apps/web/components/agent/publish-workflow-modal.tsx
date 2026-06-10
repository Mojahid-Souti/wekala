// Publish-as-agent flow for the workflow studio: pick a workflow → confirm it
// goes to the security agent → live scan progress → approved (Bazaar) or blocked.
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type VettingFindingOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Stage = "pick" | "confirm" | "scanning" | "done";

type DoneState = {
  agentId: string;
  outcome: string; // auto_approved | ready_for_review | rejected | error | failed
  findings: VettingFindingOut[];
};

export function PublishWorkflowModal({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const token = useToken();
  const [stage, setStage] = useState<Stage>("pick");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<{ agentId: string; runId: string } | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);

  const sources = useQuery({
    queryKey: ["workflow-sources", workspaceId],
    queryFn: () => api.agents.workflowSources(workspaceId, token),
    enabled: !!token && open && stage === "pick",
  });

  // Poll the vetting run while the security agent scans.
  useQuery({
    queryKey: ["publish-vetting", run?.runId],
    queryFn: async () => {
      if (!run) return null;
      const r = await api.vetting.getRun(workspaceId, run.agentId, run.runId, token);
      if (r.status === "completed" || r.status === "failed") {
        const findings = await api.vetting
          .listFindings(workspaceId, run.agentId, run.runId, token)
          .catch(() => []);
        setDone({
          agentId: run.agentId,
          outcome: r.status === "failed" ? "failed" : (r.outcome ?? "ready_for_review"),
          findings,
        });
        setStage("done");
        setRun(null);
      }
      return r;
    },
    enabled: !!run,
    refetchInterval: 1500,
  });

  function reset() {
    setStage("pick");
    setSelected(null);
    setBusy(false);
    setError(null);
    setRun(null);
    setDone(null);
  }

  async function handlePublish() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.agents.registerWorkflow(workspaceId, selected, token);
      setRun({ agentId: res.agent.id, runId: res.vetting_run_id });
      setStage("scanning");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't publish this workflow");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {stage === "pick" && (
          <>
            <DialogHeader>
              <DialogTitle>Publish a workflow as an agent</DialogTitle>
              <DialogDescription>
                Pick the automation you built. It becomes a Draft agent and goes through automated
                security testing before it can be hired.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 max-h-72 space-y-1.5 overflow-auto">
              {sources.isLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
                  <Loader2 className="size-4 animate-spin" /> Loading your workflows…
                </div>
              ) : sources.data && sources.data.length > 0 ? (
                sources.data.map((wf) => (
                  <button
                    type="button"
                    key={wf.id}
                    onClick={() => setSelected(wf.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selected === wf.id
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <span className="truncate text-sm font-medium text-neutral-900">
                      {wf.name || "Untitled workflow"}
                    </span>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        wf.active
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {wf.active ? "active" : "inactive"}
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-neutral-400">
                  No workflows yet — build one on the canvas first.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStage("confirm")}
                disabled={!selected}
                className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {stage === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-neutral-700" /> Submit for security review
              </DialogTitle>
              <DialogDescription>
                Your workflow will be submitted for{" "}
                <strong>automated testing by our security agent</strong>. It checks for
                data-sovereignty, sensitive-data, and credential issues against Oman's PDPL before
                the agent can go live.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStage("pick")}
                className="inline-flex h-9 items-center rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                Yes, run the security agent
              </button>
            </div>
          </>
        )}

        {stage === "scanning" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="relative grid size-12 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-neutral-200" />
              <ShieldCheck className="relative size-7 text-neutral-700" />
            </span>
            <p className="text-sm font-medium text-neutral-950">The security agent is scanning…</p>
            <p className="max-w-xs text-xs text-neutral-500">
              Checking nodes, destinations, and parameters against PDPL rules. This usually takes a
              few seconds.
            </p>
          </div>
        )}

        {stage === "done" && done && (
          <PublishResult
            workspaceId={workspaceId}
            done={done}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PublishResult({
  workspaceId,
  done,
  onClose,
}: {
  workspaceId: string;
  done: DoneState;
  onClose: () => void;
}) {
  const approved = done.outcome === "auto_approved";
  const pending = done.outcome === "ready_for_review";
  const blocked = done.outcome === "rejected";

  const Icon = approved ? CheckCircle2 : pending ? ShieldCheck : ShieldAlert;
  const iconColor = approved ? "text-emerald-600" : pending ? "text-neutral-700" : "text-red-600";
  const title = approved
    ? "Approved — your agent is live"
    : pending
      ? "Passed the scan — awaiting a reviewer"
      : blocked
        ? "Blocked by the security agent"
        : "The scan didn't complete";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className={`size-5 ${iconColor}`} /> {title}
        </DialogTitle>
        <DialogDescription>
          {approved
            ? "It cleared every PDPL check and is now hireable in the Bazaar."
            : pending
              ? "No blocking issues, but its classification needs a human reviewer to approve."
              : blocked
                ? "Fix the issues below in the studio, then publish again."
                : "Try again, or check that the workflow engine is running."}
        </DialogDescription>
      </DialogHeader>

      {done.findings.length > 0 && (
        <div className="mt-2 max-h-56 space-y-1.5 overflow-auto">
          {done.findings.map((f) => (
            <div key={f.id} className="rounded-lg border border-neutral-200 p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-neutral-700">{f.finding_type}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${severityClass(f.severity)}`}
                >
                  {f.severity}
                </span>
              </div>
              <p className="mt-1 text-neutral-500">{f.matched_preview}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-lg border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Close
        </button>
        <Link
          href={ROUTES.agentDetail(workspaceId, done.agentId)}
          className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {blocked ? "Open agent" : "View agent"}
        </Link>
      </div>
    </>
  );
}

function severityClass(severity: string): string {
  if (severity === "critical" || severity === "high") return "bg-red-50 text-red-600";
  if (severity === "medium") return "bg-amber-50 text-amber-600";
  return "bg-neutral-100 text-neutral-500";
}
