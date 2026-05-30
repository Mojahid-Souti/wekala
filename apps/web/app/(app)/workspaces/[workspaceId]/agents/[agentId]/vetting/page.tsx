"use client";

import {
  type CodePanelHandle,
  type CodePanelMetrics,
  VettingCodePanel,
} from "@/components/vetting/vetting-code-panel";
import { VettingDecisionInbox } from "@/components/vetting/vetting-decision-inbox";
import {
  type ColumnFinding,
  type FindingGroup,
  VettingFindingsColumn,
} from "@/components/vetting/vetting-findings-column";
import { VettingHistoryButton } from "@/components/vetting/vetting-history-button";
import { VettingStatusBadge } from "@/components/vetting/vetting-status-badge";
import { VettingSuccessPanel } from "@/components/vetting/vetting-success-panel";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const POLL_MS = 2000;

export default function VettingPage() {
  const { workspaceId, agentId } = useParams<{ workspaceId: string; agentId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: agent } = useQuery({
    queryKey: ["agent", workspaceId, agentId],
    queryFn: () => api.agents.get(workspaceId, agentId, token),
    enabled: !!token,
  });

  const { data: runs } = useQuery({
    queryKey: ["vetting-runs", agentId],
    queryFn: () => api.vetting.listRuns(workspaceId, agentId, token),
    enabled: !!token,
    refetchInterval: (q) => {
      const data = q.state.data as { status: string }[] | undefined;
      const scanning = data?.some((r) => r.status === "scanning");
      return scanning ? POLL_MS : false;
    },
  });

  const latest = runs?.[0];

  const { data: findings } = useQuery({
    queryKey: ["vetting-findings", latest?.id],
    queryFn: () =>
      latest
        ? api.vetting.listFindings(workspaceId, agentId, latest.id, token)
        : Promise.resolve([]),
    enabled: !!token && !!latest && latest.status === "completed",
  });

  const { data: yamlPayload, isLoading: yamlLoading } = useQuery({
    queryKey: ["agent-yaml", workspaceId, agentId],
    queryFn: () => api.agents.yaml(workspaceId, agentId, token),
    enabled: !!token,
  });

  const submit = useMutation({
    mutationFn: () => api.vetting.submit(workspaceId, agentId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetting-runs", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      toast("Submitted for review. Scanning…", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Submit failed", "error"),
  });

  const approve = useMutation({
    mutationFn: () =>
      latest ? api.vetting.approve(workspaceId, agentId, latest.id, note, token) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetting-runs", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      setNote("");
      toast("Agent approved.", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Approve failed", "error"),
  });

  const reject = useMutation({
    mutationFn: () =>
      latest ? api.vetting.reject(workspaceId, agentId, latest.id, note, token) : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetting-runs", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", workspaceId, agentId] });
      setNote("");
      toast("Agent rejected. Status reverted to Draft.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Reject failed", "error"),
  });

  const canSubmit =
    agent?.status === "draft" ||
    agent?.vetting_status === "unvetted" ||
    agent?.vetting_status === "failed";

  const yamlText = yamlPayload?.yaml ?? "";

  // Map each finding to a line by searching for its snippet in the YAML.
  // We normalize both sides (collapse whitespace, lowercase) so the LLM's
  // `matched_full` doesn't have to be a byte-exact copy of what's in the
  // file — otherwise "OM81..." with a leading space won't match the YAML
  // line, and the card shows "no line".
  const columnFindings: ColumnFinding[] = useMemo(() => {
    if (!findings) return [];
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const normalizedLines = yamlText.split("\n").map(normalize);
    return findings.map((f) => {
      let line: number | null = null;
      const snippet = (f.matched_full || f.matched_preview || "").trim();
      if (snippet) {
        const needle = normalize(snippet).slice(0, 60);
        if (needle) {
          for (let i = 0; i < normalizedLines.length; i += 1) {
            if (normalizedLines[i].includes(needle)) {
              line = i + 1;
              break;
            }
          }
        }
      }
      return {
        id: f.id,
        severity: f.severity as ColumnFinding["severity"],
        finding_type: f.finding_type,
        location: f.location,
        matched_full: f.matched_full ?? null,
        matched_preview: f.matched_preview ?? null,
        line,
      };
    });
  }, [findings, yamlText]);

  // Group findings by YAML line — same line = same card with internal pager.
  // Sort groups by line ascending so reviewers read the YAML top-to-bottom;
  // unmapped (no-line) findings sink to the bottom as one-per-card groups.
  const findingGroups: FindingGroup[] = useMemo(() => {
    const byLine = new Map<number, ColumnFinding[]>();
    const noLine: ColumnFinding[] = [];
    for (const f of columnFindings) {
      if (f.line == null) {
        noLine.push(f);
      } else {
        const arr = byLine.get(f.line) ?? [];
        arr.push(f);
        byLine.set(f.line, arr);
      }
    }
    const sevRank: Record<ColumnFinding["severity"], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const groups: FindingGroup[] = [];
    const sortedLines = Array.from(byLine.keys()).sort((a, b) => a - b);
    for (const line of sortedLines) {
      const findings = byLine.get(line) ?? [];
      findings.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
      groups.push({ id: `line-${line}`, line, findings });
    }
    for (const f of noLine) {
      groups.push({ id: `noline-${f.id}`, line: null, findings: [f] });
    }
    return groups;
  }, [columnFindings]);

  const lineDecorations = useMemo(() => {
    const m = new Map<
      number,
      { type: "critical" | "high" | "medium" | "low"; tip: string; count: number }
    >();
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    // Group tooltips per line so the user can hover and read all findings
    // on that line in one place.
    const tipsByLine = new Map<number, string[]>();
    for (const f of columnFindings) {
      if (!f.line) continue;
      const tip = `${f.severity.toUpperCase()} · ${f.finding_type}: ${f.matched_full || f.matched_preview || ""}`;
      const arr = tipsByLine.get(f.line) ?? [];
      arr.push(tip);
      tipsByLine.set(f.line, arr);

      const existing = m.get(f.line);
      if (!existing) {
        m.set(f.line, { type: f.severity, tip: "", count: 1 });
      } else {
        existing.count += 1;
        if (rank[f.severity] < rank[existing.type]) existing.type = f.severity;
      }
    }
    // Stamp combined tooltip text last so multi-finding lines list all of them.
    for (const [line, tips] of tipsByLine.entries()) {
      const entry = m.get(line);
      if (entry) entry.tip = tips.join("\n");
    }
    return m;
  }, [columnFindings]);

  // Split-pane state.
  const codePanelRef = useRef<CodePanelHandle>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flashLine, setFlashLine] = useState<number | null>(null);
  // When the reviewer clicks a card, we briefly ignore editor-scroll-driven
  // active-index updates. Without this, clicking the 2nd card for L22 fires
  // a scroll, the scroll handler runs findIndex(line === 22) → returns the
  // 1st L22 card → resets activeIndex right back. The user's click is
  // visually swallowed.
  const jumpLockUntilRef = useRef(0);

  function jumpToGroup(index: number) {
    const g = findingGroups[index];
    if (!g) return;
    setActiveIndex(index);
    jumpLockUntilRef.current = Date.now() + 600;
    if (g.line != null) {
      codePanelRef.current?.scrollToLine(g.line, { smooth: true });
      setFlashLine(g.line);
      window.setTimeout(() => setFlashLine(null), 1600);
    }
  }

  // Drive activeIndex from the editor's scroll position — unless a click
  // just happened, in which case we trust the user.
  function handleEditorScroll(m: CodePanelMetrics) {
    if (Date.now() < jumpLockUntilRef.current) return;
    const topLine = Math.floor(m.scrollTop / m.lineHeightPx) + 1;
    const bottomLine = topLine + Math.floor(m.clientHeight / m.lineHeightPx);
    // Find the topmost group whose line is in the visible editor band.
    const idx = findingGroups.findIndex(
      (g) => g.line != null && g.line >= topLine && g.line <= bottomLine
    );
    if (idx >= 0 && idx !== activeIndex) setActiveIndex(idx);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-5 py-6 lg:px-7">
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <Link
            href={ROUTES.agentDetail(workspaceId, agentId)}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="size-3.5" />
            Back to agent
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Vetting</h1>
          <p className="text-sm text-neutral-500">
            Safety review — PII detection and prompt-injection scanning.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {agent && <VettingStatusBadge status={agent.vetting_status} />}
          {runs && runs.length > 1 && <VettingHistoryButton runs={runs} agentId={agentId} />}
          {latest &&
            latest.status === "completed" &&
            latest.outcome === "ready_for_review" &&
            !latest.approval_decision &&
            columnFindings.length > 0 && (
              <VettingDecisionInbox
                runId={latest.id}
                blocked={(latest.finding_summary?.by_severity?.critical ?? 0) > 0}
                criticalCount={latest.finding_summary?.by_severity?.critical ?? 0}
                note={note}
                onNoteChange={setNote}
                onApprove={() => {
                  if (!approve.isPending && !reject.isPending) approve.mutate();
                }}
                onReject={() => {
                  if (!reject.isPending && !approve.isPending) reject.mutate();
                }}
                approving={approve.isPending}
                rejecting={reject.isPending}
              />
            )}
          {canSubmit && (
            <button
              type="button"
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
              className="inline-flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-md bg-neutral-950 px-5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {submit.isPending && <Loader2 className="size-4 animate-spin" />}
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </button>
          )}
        </div>
      </header>

      {/* Scanning state */}
      {latest && latest.status === "scanning" && (
        <section className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <Loader2 className="size-4 animate-spin" />
          Scanning in progress. This page auto-refreshes when results land.
        </section>
      )}

      {/* Latest completed run */}
      {latest && latest.status === "completed" && (
        <>
          {/* KPI summary card — first, so reviewers see the verdict before
              diving into details. Status + Outcome + Classification as a top
              meta row; severity counts as 5 tiles below. */}
          {latest.finding_summary && (
            <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Latest run
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                  <MetaItem label="Status" value={latest.status} />
                  {latest.outcome && (
                    <MetaItem label="Outcome" value={latest.outcome.replace(/_/g, " ")} />
                  )}
                  <MetaItem label="Classification" value={latest.classification} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-neutral-100 sm:grid-cols-5">
                <SummaryStat label="Total" value={latest.finding_summary.total ?? 0} />
                <SummaryStat
                  label="Critical"
                  value={latest.finding_summary.by_severity?.critical ?? 0}
                  tone={(latest.finding_summary.by_severity?.critical ?? 0) > 0 ? "rose" : "gray"}
                />
                <SummaryStat
                  label="High"
                  value={latest.finding_summary.by_severity?.high ?? 0}
                  tone={(latest.finding_summary.by_severity?.high ?? 0) > 0 ? "rose" : "gray"}
                />
                <SummaryStat
                  label="Medium"
                  value={latest.finding_summary.by_severity?.medium ?? 0}
                  tone={(latest.finding_summary.by_severity?.medium ?? 0) > 0 ? "amber" : "gray"}
                />
                <SummaryStat label="Low" value={latest.finding_summary.by_severity?.low ?? 0} />
              </div>
            </section>
          )}

          {/* Decision panel has moved to the VettingDecisionInbox button in the
              page header — it opens a centred Dialog with the same content and
              actions. The split-pane editor now sits directly under the KPI
              card. */}

          {/* Reviewer-decision banner removed entirely — the header status
              badge already shows Approved / Rejected. The audit note lives in
              the history sheet for past runs. */}

          {/* Deep dive — split pane (cards + editor + arrows) or success state */}
          {columnFindings.length === 0 ? (
            <VettingSuccessPanel
              classification={latest.classification}
              onApprove={() => approve.mutate()}
              approving={approve.isPending}
              alreadyApproved={latest.outcome === "auto_approved" || !!latest.approval_decision}
            />
          ) : (
            <section className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <VettingFindingsColumn
                groups={findingGroups}
                activeIndex={activeIndex}
                onJumpToIndex={jumpToGroup}
                onActiveChange={setActiveIndex}
              />
              <VettingCodePanel
                yaml={yamlText}
                loading={yamlLoading}
                highlightLines={lineDecorations}
                flashLine={flashLine}
                onScroll={handleEditorScroll}
                ref={codePanelRef}
                // Cap to the findings column's 3-card window so the two panes
                // stay aligned and the editor never towers over the cards.
                // 3 cards × 140px + 2 gaps × 8px + 32px column header = 468px.
                // Use group count (not raw findings count) since cards now
                // represent grouped-by-line clusters.
                maxHeightPx={
                  findingGroups.length >= 3 ? 468 : findingGroups.length === 2 ? 320 : 180
                }
              />
            </section>
          )}
        </>
      )}

      {!runs && (
        <div className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
      )}
      {runs && runs.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-700">
            <ShieldCheck className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-neutral-950">Not vetted yet</h3>
          <p className="mt-1.5 max-w-md text-sm text-neutral-500">
            This agent hasn&rsquo;t been through PII detection or prompt-injection scanning. Click{" "}
            <span className="font-medium text-neutral-700">Submit for review</span> above to start
            the safety pipeline.
          </p>
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-neutral-500">{label}</span>
      <strong className="font-medium text-neutral-900">{value}</strong>
    </span>
  );
}

function SummaryStat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "rose" | "amber";
}) {
  const numberClass =
    tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-neutral-900";
  return (
    <div className="bg-white px-6 py-5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={cn("mt-1.5 text-3xl font-semibold tabular-nums leading-none", numberClass)}>
        {value}
      </p>
    </div>
  );
}
