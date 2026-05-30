"use client";

import { SeverityBadge } from "@/components/vetting/vetting-status-badge";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const VISIBLE_CARDS = 3;
const CARD_HEIGHT_PX = 140;
const CARD_GAP_PX = 8;
const STEP_PX = CARD_HEIGHT_PX + CARD_GAP_PX;

const SEVERITY_RANK: Record<ColumnFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type ColumnFinding = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  finding_type: string;
  location: string;
  matched_full: string | null;
  matched_preview: string | null;
  line: number | null;
};

export type FindingGroup = {
  /** Stable group id — `line-22` or `noline-<finding-id>` for unmapped ones. */
  id: string;
  line: number | null;
  findings: ColumnFinding[];
};

type Props = {
  /** Groups: one per line, sorted by line ascending. Multi-violation lines
   *  carry several findings in a single group rendered as a pager card. */
  groups: FindingGroup[];
  activeIndex: number;
  /** Receives the group's index. The page jumps to `groups[i].line`. */
  onJumpToIndex: (index: number) => void;
  onActiveChange: (index: number) => void;
};

export function VettingFindingsColumn({
  groups,
  activeIndex,
  onJumpToIndex,
  onActiveChange,
}: Props) {
  // Translate index — index of the FIRST visible card. Card-list slides as a
  // whole; with 3-visible we centre on activeIndex by setting translate to
  // activeIndex - 1.
  const [translateIdx, setTranslateIdx] = useState(0);

  const max = Math.max(0, groups.length - VISIBLE_CARDS);

  useEffect(() => {
    if (groups.length <= VISIBLE_CARDS) {
      setTranslateIdx(0);
      return;
    }
    const desired = Math.max(0, Math.min(max, activeIndex - 1));
    setTranslateIdx(desired);
  }, [activeIndex, groups.length, max]);

  function step(dir: 1 | -1) {
    const next = Math.max(0, Math.min(max, translateIdx + dir));
    setTranslateIdx(next);
    const newActive = Math.max(0, Math.min(groups.length - 1, next + 1));
    onActiveChange(newActive);
  }

  const viewportPx = VISIBLE_CARDS * CARD_HEIGHT_PX + (VISIBLE_CARDS - 1) * CARD_GAP_PX;
  const hasOverflow = groups.length > VISIBLE_CARDS;
  const totalFindings = useMemo(
    () => groups.reduce((acc, g) => acc + g.findings.length, 0),
    [groups]
  );

  return (
    <div className="space-y-3" data-findings-column>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Findings ({totalFindings})
        </h3>
        {hasOverflow && (
          <div className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={translateIdx <= 0}
              aria-label="Previous findings"
              className="grid size-7 place-items-center text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <span className="px-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
              {translateIdx + 1}–{Math.min(groups.length, translateIdx + VISIBLE_CARDS)} of{" "}
              {groups.length}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={translateIdx >= max}
              aria-label="Next findings"
              className="grid size-7 place-items-center text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div
        className="relative overflow-hidden"
        style={{ height: hasOverflow ? viewportPx : "auto" }}
      >
        <div
          className="space-y-2"
          style={{
            transform: hasOverflow ? `translateY(-${translateIdx * STEP_PX}px)` : undefined,
            transition: "transform 350ms cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        >
          {groups.map((g, i) => (
            <GroupCard
              key={g.id}
              group={g}
              isActive={i === activeIndex}
              onJump={() => onJumpToIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  isActive,
  onJump,
}: {
  group: FindingGroup;
  isActive: boolean;
  onJump: () => void;
}) {
  // Internal pager — reset to 0 only when the group identity changes.
  const [innerIdx, setInnerIdx] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: group.id is the intentional reset trigger.
  useEffect(() => {
    setInnerIdx(0);
  }, [group.id]);

  const findings = group.findings;
  const current = findings[Math.min(innerIdx, findings.length - 1)];
  const hasPager = findings.length > 1;
  // Group badge severity = the most severe finding in the group, since that
  // governs whether the line is blocked.
  const groupSeverity = useMemo(
    () =>
      findings.reduce<ColumnFinding["severity"]>(
        (acc, f) => (SEVERITY_RANK[f.severity] < SEVERITY_RANK[acc] ? f.severity : acc),
        findings[0]?.severity ?? "low"
      ),
    [findings]
  );

  function cycle(dir: 1 | -1) {
    setInnerIdx((prev) => (prev + dir + findings.length) % findings.length);
  }

  if (!current) return null;

  return (
    <div
      data-group-id={group.id}
      data-line={group.line ?? ""}
      // biome-ignore lint/a11y/useSemanticElements: card is button-like but contains nested pager buttons, so it can't be a native <button>.
      role="button"
      tabIndex={0}
      onClick={onJump}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onJump();
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border bg-white p-4 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20",
        isActive
          ? "border-neutral-900 shadow-[0_0_0_3px_rgba(10,10,10,0.06)]"
          : "border-neutral-200 hover:border-neutral-400"
      )}
      style={{ height: CARD_HEIGHT_PX }}
    >
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={groupSeverity} />
            <span className="font-mono text-xs text-neutral-700">{current.finding_type}</span>
            <span className="text-xs text-neutral-400">· {current.location}</span>
          </div>
          <p
            className={cn(
              "font-mono text-xs",
              current.matched_full ? "text-neutral-700" : "text-neutral-500"
            )}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {current.matched_full ||
              `${current.matched_preview ?? ""} (redacted — admin role required)`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {group.line ? (
            <span
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                isActive
                  ? "border-neutral-900 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 group-hover:border-neutral-400"
              )}
            >
              L{group.line}
              <ArrowRight className="size-3" />
            </span>
          ) : (
            <span className="text-[11px] text-neutral-400">no line</span>
          )}
          {hasPager && (
            <div
              className="flex items-center gap-0.5 rounded-md border border-neutral-200 bg-white"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => cycle(-1)}
                aria-label="Previous violation on this line"
                className="grid size-6 place-items-center text-neutral-500 hover:text-neutral-900"
              >
                <ChevronLeft className="size-3" />
              </button>
              <span className="px-1 text-[10px] font-medium tabular-nums text-neutral-600">
                {innerIdx + 1}/{findings.length}
              </span>
              <button
                type="button"
                onClick={() => cycle(1)}
                aria-label="Next violation on this line"
                className="grid size-6 place-items-center text-neutral-500 hover:text-neutral-900"
              >
                <ChevronRight className="size-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
