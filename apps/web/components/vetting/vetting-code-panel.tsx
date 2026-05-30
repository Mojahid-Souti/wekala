"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import { type Ref, forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";

const MIN_FONT = 11;
const MAX_FONT = 18;
const DEFAULT_FONT = 12;
const LINE_HEIGHT = 1.65;
const VISIBLE_LINES = 30; // Fixed editor viewport — scroll happens inside.

export type CodePanelMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  lineHeightPx: number;
  // Y offset (in container coords) of line 1's top edge — accounts for padding.
  contentTopPx: number;
};

export type CodePanelHandle = {
  scrollToLine: (line: number, opts?: { smooth?: boolean }) => void;
  getMetrics: () => CodePanelMetrics | null;
  getScrollContainer: () => HTMLDivElement | null;
};

type DecorationType = "critical" | "high" | "medium" | "low";

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type DecorationInfo = { type: DecorationType; tip: string; count: number };

function decorate(
  code: string,
  highlightLines: Map<number, DecorationInfo>,
  flashLine: number | null
): string {
  const html = Prism.highlight(code, Prism.languages.yaml ?? Prism.languages.markup, "yaml");
  const lines = html.split("\n");
  for (const [lineNum, info] of highlightLines.entries()) {
    if (lineNum < 1 || lineNum > lines.length) continue;
    const cls = `yaml-finding-${info.type}`;
    // Multi-finding lines get a small inline `[N]` count badge so the
    // reviewer can see at a glance which lines stack multiple violations
    // — the cards group by line, this is the editor's mirror.
    const badge = info.count > 1 ? ` <span class="yaml-finding-count">×${info.count}</span>` : "";
    lines[lineNum - 1] =
      `<span class="${cls}" title="${escapeAttr(info.tip)}">${lines[lineNum - 1]}${badge}</span>`;
  }
  if (flashLine !== null && flashLine >= 1 && flashLine <= lines.length) {
    lines[flashLine - 1] = `<span class="yaml-flash-line">${lines[flashLine - 1]}</span>`;
  }
  return lines.join("\n");
}

type Props = {
  yaml: string;
  loading: boolean;
  highlightLines: Map<number, DecorationInfo>;
  flashLine?: number | null;
  onScroll?: (metrics: CodePanelMetrics) => void;
  className?: string;
  /** Outer cap. When set, the editor's height never exceeds this many
   *  pixels (including header), so it can match the findings column. */
  maxHeightPx?: number;
};

function VettingCodePanelImpl(
  { yaml, loading, highlightLines, flashLine, onScroll, className, maxHeightPx }: Props,
  ref: Ref<CodePanelHandle>
) {
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const scrollRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);

  const decorated = useMemo(
    () => decorate(yaml, highlightLines, flashLine ?? null),
    [yaml, highlightLines, flashLine]
  );

  const lineCount = useMemo(() => (yaml ? yaml.split("\n").length : 1), [yaml]);
  const lineHeightPx = fontSize * LINE_HEIGHT;
  // Editor body padding (matches the `p-4` on the scroll container = 16px).
  const PAD_Y = 16;
  const HEADER_PX = 32;
  // Cap at VISIBLE_LINES so long YAML scrolls internally, but shrink to the
  // actual content height when the file is shorter. If the parent passes a
  // `maxHeightPx` cap (to align with the findings column), respect that too.
  const effectiveLines = Math.min(VISIBLE_LINES, Math.max(1, lineCount));
  let bodyPx = effectiveLines * lineHeightPx + PAD_Y * 2;
  if (maxHeightPx) {
    bodyPx = Math.min(bodyPx, Math.max(0, maxHeightPx - HEADER_PX));
  }

  function metrics(): CodePanelMetrics | null {
    const el = scrollRef.current;
    if (!el) return null;
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      lineHeightPx,
      contentTopPx: PAD_Y,
    };
  }

  // Handle re-creates only when lineHeightPx changes; `metrics` reads live refs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: metrics reads refs, not deps.
  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(line, opts) {
        const el = scrollRef.current;
        if (!el || line < 1) return;
        const target = (line - 1) * lineHeightPx;
        // Centre the target line in the viewport.
        const offset = target - el.clientHeight / 2 + lineHeightPx / 2 + PAD_Y;
        el.scrollTo({ top: Math.max(0, offset), behavior: opts?.smooth ? "smooth" : "auto" });
      },
      getMetrics: metrics,
      getScrollContainer: () => scrollRef.current,
    }),
    [lineHeightPx]
  );

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950 text-neutral-100",
        className
      )}
      style={{ height: bodyPx + HEADER_PX }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
        <span className="flex items-center gap-2">
          <span>YAML</span>
          {!loading && yaml && (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="size-3" /> source of truth
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0 rounded-md border border-neutral-700 bg-neutral-900">
            <button
              type="button"
              onClick={() => setFontSize((f) => Math.max(MIN_FONT, f - 1))}
              disabled={fontSize <= MIN_FONT}
              aria-label="Zoom out"
              className="grid size-6 place-items-center text-neutral-400 hover:text-neutral-100 disabled:opacity-40"
            >
              <Minus className="size-3" />
            </button>
            <span className="px-1.5 text-[10px] text-neutral-400">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize((f) => Math.min(MAX_FONT, f + 1))}
              disabled={fontSize >= MAX_FONT}
              aria-label="Zoom in"
              className="grid size-6 place-items-center text-neutral-400 hover:text-neutral-100 disabled:opacity-40"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <span>{lineCount.toLocaleString()} lines</span>
        </div>
      </div>

      {/* Scroll body — gutter + code share the same overflow container so they
          scroll together without explicit sync logic. */}
      <div
        ref={scrollRef}
        onScroll={() => {
          if (onScroll) {
            const m = metrics();
            if (m) onScroll(m);
          }
        }}
        className="yaml-editor-scroll flex-1 overflow-auto"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading agent YAML…
          </div>
        ) : (
          <div
            className="flex"
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              fontSize,
              lineHeight: LINE_HEIGHT,
              padding: `${PAD_Y}px 0`,
            }}
          >
            {/* Line-number gutter */}
            <div
              aria-hidden
              className="select-none border-r border-neutral-800 px-3 text-right text-neutral-600"
              style={{ minWidth: 56 }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: gutter line N is always line N — index is the stable identity.
                <div key={i} style={{ height: lineHeightPx }}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code */}
            <pre
              ref={codeRef}
              className="m-0 flex-1 overflow-visible px-4"
              style={{ whiteSpace: "pre", margin: 0 }}
            >
              <code
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Prism-highlighted YAML
                dangerouslySetInnerHTML={{
                  __html: decorated || '<span class="text-neutral-500">(empty)</span>',
                }}
              />
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export const VettingCodePanel = forwardRef<CodePanelHandle, Props>(VettingCodePanelImpl);
