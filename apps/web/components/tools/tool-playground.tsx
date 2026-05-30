"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ToolOut, api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, ImageIcon, Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";

// HF ZeroGPU / shared-GPU failures are transient — show a retry hint, not a
// scary stack-trace-y error.
const TRANSIENT_RE = /acceleratorerror|zerogpu|quota|gpu|timeout|503|temporarily/i;

function friendlyError(raw: string): { message: string; transient: boolean } {
  if (TRANSIENT_RE.test(raw)) {
    return {
      message:
        "This tool isn't available right now (the shared GPU is busy). Click Run to try again.",
      transient: true,
    };
  }
  return { message: raw, transient: false };
}

type FieldKind = "text" | "textarea" | "number" | "boolean" | "select" | "json";

type Field = {
  name: string;
  kind: FieldKind;
  required: boolean;
  description?: string;
  options?: string[];
};

const LONG_TEXT = /question|prompt|text|content|body|message|description|query/i;

/**
 * Turn a tool's JSON-Schema `input_schema` into a flat list of form fields.
 * Pragmatic: covers string/number/boolean/enum directly; anyOf-with-string is
 * treated as a string; everything else (array/object/unions) falls back to a
 * raw-JSON textarea so any tool is still runnable.
 */
function parseSchema(schema: Record<string, unknown>): Field[] {
  const props = (schema?.properties as Record<string, Record<string, unknown>>) ?? {};
  const required = new Set((schema?.required as string[]) ?? []);
  const fields: Field[] = [];

  for (const [name, def] of Object.entries(props)) {
    let type = def.type as string | undefined;
    if (!type && Array.isArray(def.anyOf)) {
      const hasString = (def.anyOf as Array<{ type?: string }>).some((o) => o?.type === "string");
      type = hasString ? "string" : undefined;
    }

    let kind: FieldKind;
    let options: string[] | undefined;
    if (Array.isArray(def.enum)) {
      kind = "select";
      options = (def.enum as unknown[]).map(String);
    } else if (type === "boolean") {
      kind = "boolean";
    } else if (type === "number" || type === "integer") {
      kind = "number";
    } else if (type === "string") {
      kind = LONG_TEXT.test(`${name} ${def.description ?? ""}`) ? "textarea" : "text";
    } else {
      kind = "json";
    }

    fields.push({
      name,
      kind,
      required: required.has(name),
      description: typeof def.description === "string" ? def.description : undefined,
      options,
    });
  }
  return fields;
}

type FormValue = string | boolean;

function buildArgs(
  fields: Field[],
  values: Record<string, FormValue>
): { args: Record<string, unknown> } | { error: string } {
  const args: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "boolean") {
      args[f.name] = Boolean(raw);
      continue;
    }
    const str = typeof raw === "string" ? raw.trim() : "";
    if (str === "") {
      if (f.required) return { error: `${f.name} is required.` };
      continue;
    }
    if (f.kind === "number") {
      const n = Number(str);
      if (Number.isNaN(n)) return { error: `${f.name} must be a number.` };
      args[f.name] = n;
    } else if (f.kind === "json") {
      try {
        args[f.name] = JSON.parse(str);
      } catch {
        return { error: `${f.name} must be valid JSON.` };
      }
    } else {
      args[f.name] = str;
    }
  }
  return { args };
}

export function ToolPlayground({
  workspaceId,
  agentId,
  tool,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  agentId: string;
  tool: ToolOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const token = useToken();
  const fields = useMemo(() => parseSchema(tool.input_schema ?? {}), [tool.input_schema]);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: (args: Record<string, unknown>) =>
      api.tools.invoke(workspaceId, agentId, tool.id, args, token),
  });

  function setField(name: string, value: FormValue) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function handleRun() {
    setFormError(null);
    const built = buildArgs(fields, values);
    if ("error" in built) {
      setFormError(built.error);
      return;
    }
    run.mutate(built.args);
  }

  const result = run.data;
  const success = result?.outcome === "success";
  const runError =
    run.isError && !result
      ? friendlyError(run.error instanceof Error ? run.error.message : "Invocation failed.")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{tool.name}</DialogTitle>
          {tool.description && (
            <DialogDescription className="max-h-20 overflow-y-auto pr-1 text-left">
              {tool.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="-mr-2 space-y-4 overflow-y-auto pr-2">
          {/* Inputs */}
          {fields.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
              This tool takes no inputs.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <label
                    htmlFor={`tp-${f.name}`}
                    className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500"
                  >
                    <span className="font-mono normal-case">{f.name}</span>
                    {f.required && <span className="text-rose-500">*</span>}
                  </label>
                  <FieldInput
                    id={`tp-${f.name}`}
                    field={f}
                    value={values[f.name]}
                    onChange={(v) => setField(f.name, v)}
                  />
                  {f.description && <p className="text-xs text-neutral-400">{f.description}</p>}
                </div>
              ))}
            </div>
          )}

          {formError && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}

          {/* Result */}
          {result && (
            <div
              className={cn(
                "space-y-2 rounded-xl border p-4",
                success ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
              )}
            >
              <div className="flex items-center justify-between gap-3 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-medium capitalize",
                    success ? "text-emerald-700" : "text-rose-700"
                  )}
                >
                  {success ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                  {result.outcome}
                </span>
                <span className="font-mono text-neutral-400">{result.latency_ms} ms</span>
              </div>

              {/* Images returned by the tool (e.g. an image generator) */}
              {result.images && result.images.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {result.images.map((img, i) => (
                    <figure
                      // biome-ignore lint/suspicious/noArrayIndexKey: images have no id; order is stable per result.
                      key={`img-${i}`}
                      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
                    >
                      <figcaption className="flex items-center justify-between gap-2 border-b border-neutral-100 px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                          <ImageIcon className="size-3.5" />
                          Image {i + 1}
                        </span>
                        <a
                          href={img.data_url}
                          download={`${tool.name}-${i + 1}.png`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
                        >
                          <Download className="size-3.5" />
                          Download
                        </a>
                      </figcaption>
                      <a href={img.data_url} target="_blank" rel="noreferrer" className="block">
                        {/* A base64 data URL can't go through next/image. */}
                        <img
                          src={img.data_url}
                          alt={`${tool.name} output ${i + 1}`}
                          className="max-h-80 w-full bg-neutral-50 object-contain"
                        />
                      </a>
                    </figure>
                  ))}
                </div>
              )}

              {/* Text output — skip the placeholder when an image already shows */}
              {(result.error || result.output_preview || !result.images?.length) && (
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono text-xs leading-relaxed text-neutral-800">
                  {result.error || result.output_preview || "(no output)"}
                </pre>
              )}
            </div>
          )}

          {runError && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
                runError.transient
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              )}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{runError.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleRun}
              disabled={run.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-950 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {run.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {run.isPending ? "Running…" : "Run"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: Field;
  value: FormValue | undefined;
  onChange: (v: FormValue) => void;
}) {
  const base =
    "block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5";

  if (field.kind === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900/20"
        />
        Enabled
      </label>
    );
  }
  if (field.kind === "select") {
    return (
      <select
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      >
        <option value="">Select…</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "textarea" || field.kind === "json") {
    return (
      <textarea
        id={id}
        rows={field.kind === "json" ? 4 : 3}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.kind === "json" ? '{ "key": "value" }' : undefined}
        className={cn(base, "resize-none", field.kind === "json" && "font-mono text-xs")}
      />
    );
  }
  return (
    <input
      id={id}
      type={field.kind === "number" ? "number" : "text"}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}
