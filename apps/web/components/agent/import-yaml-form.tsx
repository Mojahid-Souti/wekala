"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { type ScanFinding, scanYaml } from "@/lib/yaml-security-scan";
import yaml from "js-yaml";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Prism from "prismjs";
import "prismjs/components/prism-yaml";
import { useCallback, useMemo, useRef, useState } from "react";
import Editor from "react-simple-code-editor";

const MAX_BYTES = 1 * 1024 * 1024;
const ALLOWED_EXTS = [".yaml", ".yml"];

type Mode = "upload" | "paste";

type ParseError = {
  message: string;
  line: number | null;
};

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAllowedFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: `File is ${humanSize(file.size)} — max is 1 MB.` };
  }
  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTS.some((ext) => name.endsWith(ext))) {
    return { ok: false, reason: "File must be .yaml or .yml." };
  }
  return { ok: true };
}

function parseYaml(input: string): ParseError | null {
  if (!input.trim()) return null;
  try {
    yaml.load(input);
    return null;
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      return {
        message: err.reason || err.message,
        line: err.mark ? err.mark.line + 1 : null,
      };
    }
    return { message: err instanceof Error ? err.message : String(err), line: null };
  }
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Inject per-line decorations on top of Prism-highlighted HTML. */
function decorate(
  code: string,
  parseError: ParseError | null,
  findingLines: Map<number, string>
): string {
  const highlighted = Prism.highlight(code, Prism.languages.yaml ?? Prism.languages.markup, "yaml");
  const lines = highlighted.split("\n");
  const errorLine = parseError?.line ?? null;

  if (errorLine !== null && errorLine >= 1 && errorLine <= lines.length) {
    const tip = escapeHtmlAttr(parseError?.message ?? "YAML parse error");
    lines[errorLine - 1] =
      `<span class="yaml-error-line" title="${tip}">${lines[errorLine - 1]}</span>`;
  }
  // Security findings (skip the line already marked as parse error).
  for (const [lineNum, msg] of findingLines.entries()) {
    if (lineNum === errorLine) continue;
    if (lineNum < 1 || lineNum > lines.length) continue;
    const tip = escapeHtmlAttr(msg);
    lines[lineNum - 1] =
      `<span class="yaml-warning-line" title="${tip}">${lines[lineNum - 1]}</span>`;
  }
  return lines.join("\n");
}

const _SEVERITY_STYLES: Record<ScanFinding["severity"], string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-800",
  high: "border-rose-200 bg-rose-50/60 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-neutral-200 bg-neutral-50 text-neutral-700",
};

const MIN_FONT = 11;
const MAX_FONT = 18;
const DEFAULT_FONT = 12;

export function ImportYamlForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseError = useMemo(() => parseYaml(pasteText), [pasteText]);
  const findings = useMemo(() => scanYaml(pasteText), [pasteText]);
  const findingLines = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of findings) {
      const existing = m.get(f.line);
      m.set(f.line, existing ? `${existing}\n${f.type}: ${f.message}` : `${f.type}: ${f.message}`);
    }
    return m;
  }, [findings]);

  const handleFile = useCallback((f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const check = isAllowedFile(f);
    if (!check.ok) {
      setFile(null);
      setError(check.reason);
      return;
    }
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files?.[0] ?? null);
    },
    [handleFile]
  );

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("Not signed in");

      let toUpload: File | null = file;
      if (mode === "paste") {
        const text = pasteText.trim();
        if (!text) throw new Error("Paste a YAML body first.");
        if (parseError) {
          throw new Error(
            `Invalid YAML${parseError.line ? ` (line ${parseError.line})` : ""}: ${parseError.message}`
          );
        }
        if (new Blob([text]).size > MAX_BYTES) {
          throw new Error("Pasted YAML is over 1 MB.");
        }
        toUpload = new File([text], "pasted.yaml", { type: "text/yaml" });
      }
      if (!toUpload) throw new Error("Select a file first.");

      await api.agents.importYaml(workspaceId, toUpload, token);
      router.push(ROUTES.agents(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  const hasCritical = findings.some((f) => f.severity === "critical");
  const canSubmit =
    !submitting && (mode === "upload" ? !!file : pasteText.trim().length > 0 && !parseError);

  return (
    <div className="space-y-5">
      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-md border border-neutral-200 bg-white text-neutral-700">
          <ShieldCheck className="size-4" />
        </div>
        <div className="min-w-0 space-y-0.5 text-xs">
          <p className="font-medium text-neutral-900">Every import is automatically vetted</p>
          <p className="text-neutral-500">
            On submit, the file is scanned for PII, prompt-injection patterns, and
            classification-policy violations. The agent stays in <strong>Draft</strong> until the
            review passes. The editor below also runs a fast client-side pre-scan as you type.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
        {(["upload", "paste"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m
                ? "bg-white text-neutral-950 shadow-sm"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            {m === "upload" ? "Upload file" : "Paste YAML"}
          </button>
        ))}
      </div>

      {/* Body */}
      {mode === "upload" ? (
        <div className="space-y-3">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
                dragging
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
              )}
            >
              <div className="grid size-12 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700">
                <UploadCloud className="size-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-neutral-950">
                Drop an agent YAML here, or click to browse
              </p>
              <p className="mt-1 text-xs text-neutral-500">.yaml or .yml · up to 1 MB</p>
              <input
                ref={inputRef}
                type="file"
                accept=".yaml,.yml,text/yaml,application/x-yaml"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-neutral-950">{file.name}</p>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                </div>
                <p className="text-xs text-neutral-500">{humanSize(file.size)} · ready to import</p>
              </div>
              <button
                type="button"
                onClick={() => handleFile(null)}
                aria-label="Remove file"
                className="grid size-8 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-lg border bg-neutral-950 text-neutral-100",
            parseError
              ? "border-rose-500/60"
              : hasCritical
                ? "border-rose-400/40"
                : "border-neutral-200"
          )}
        >
          {/* Editor header — status chips + zoom */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-3 py-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
            <div className="flex items-center gap-2">
              <span>YAML</span>
              {pasteText.trim() && !parseError && (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="size-3" /> valid
                </span>
              )}
              {parseError && (
                <span className="inline-flex items-center gap-1 text-rose-400">
                  <AlertCircle className="size-3" /> parse error
                </span>
              )}
              {findings.length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <AlertCircle className="size-3" />
                  {findings.length} security {findings.length === 1 ? "issue" : "issues"}
                </span>
              )}
            </div>
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
              <span>{pasteText.length.toLocaleString()} chars</span>
            </div>
          </div>

          {/* Editor body — hidden-but-scrollable */}
          <div className="yaml-editor-scroll max-h-[60vh] overflow-auto">
            <Editor
              value={pasteText}
              onValueChange={(val) => {
                setPasteText(val);
                setError(null);
              }}
              highlight={(code) => decorate(code, parseError, findingLines)}
              padding={14}
              placeholder="app:&#10;  name: My Agent&#10;  description: ...&#10;  mode: chat&#10;model:&#10;  ..."
              textareaClassName="focus:outline-none"
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                fontSize,
                lineHeight: 1.65,
                minHeight: 380,
              }}
            />
          </div>

          {/* Inline issues footer — one row per issue */}
          {(parseError || findings.length > 0) && (
            <div className="max-h-[28vh] overflow-auto border-t border-neutral-800 yaml-editor-scroll">
              {parseError && (
                <div className="flex items-start gap-2 border-b border-neutral-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium">YAML parse error</span>
                    {parseError.line && (
                      <span className="text-rose-300/80"> · line {parseError.line}</span>
                    )}
                    <p className="text-rose-100/80">{parseError.message}</p>
                  </div>
                </div>
              )}
              {findings.map((f) => (
                <div
                  key={f.id}
                  className="flex items-start gap-2 border-b border-neutral-800 px-3 py-2 text-xs last:border-b-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      f.severity === "critical" && "bg-rose-500/20 text-rose-300",
                      f.severity === "high" && "bg-rose-500/15 text-rose-200/90",
                      f.severity === "medium" && "bg-amber-500/15 text-amber-200",
                      f.severity === "low" && "bg-neutral-500/15 text-neutral-300"
                    )}
                  >
                    {f.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-100">
                      <span className="font-mono text-neutral-400">L{f.line}</span>{" "}
                      <span className="font-medium">{f.type}</span>
                      <span className="text-neutral-400"> — {f.message}</span>
                    </p>
                    {f.snippet && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">
                        {f.snippet}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} disabled={!canSubmit} className="min-w-[120px]">
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Importing…
            </>
          ) : (
            "Import"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(ROUTES.agents(workspaceId))}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
