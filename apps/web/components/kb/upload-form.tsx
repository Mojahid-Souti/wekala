"use client";

import type { KBUploadAcceptedOut } from "@/lib/api";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

type Props = {
  workspaceId: string;
  kbId: string;
  token: string;
  onUploaded: (result: KBUploadAcceptedOut) => void;
};

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".html"];
// idle → uploading (bytes 0–100%) → processing (server scans + stores) → done
type Phase = "idle" | "uploading" | "processing" | "success" | "failed";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadForm({ workspaceId, kbId, token, onUploaded }: Props) {
  const t = useTranslations("knowledgeBase.upload");
  const securityNote = useTranslations("knowledgeBase")("securityNote");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const validateFile = (f: File): string | null => {
    if (f.size > 50 * 1024 * 1024) return t("errorFileTooLarge");
    const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) return t("errorFileType");
    return null;
  };

  const reset = () => {
    setFile(null);
    setPhase("idle");
    setProgress(0);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Auto-upload as soon as a valid file is chosen (drop or browse) — matches
  // the user's mental model: dropping a file *is* the upload.
  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      setPhase("failed");
      return;
    }
    setError(null);
    setFile(f);
    upload(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  // Uses XHR rather than fetch because only XHR exposes upload progress
  // events. Phases: bytes-sent (uploading) → server scan/store (processing).
  const upload = (f: File) => {
    setPhase("uploading");
    setProgress(0);
    setError(null);

    const form = new FormData();
    form.append("file", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/v1/workspaces/${workspaceId}/kbs/${kbId}/documents`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
    };
    // Bytes are all sent — now the server virus-scans + stores before it
    // replies, which is the wait the user was seeing as "stuck at 100%".
    xhr.upload.onload = () => {
      setProgress(100);
      setPhase("processing");
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setPhase("success");
        try {
          onUploaded(JSON.parse(xhr.responseText) as KBUploadAcceptedOut);
        } catch {
          onUploaded({ document_id: "", status: "accepted", duplicate: false, message: "" });
        }
      } else {
        setPhase("failed");
        try {
          const body = JSON.parse(xhr.responseText);
          setError(typeof body.detail === "string" ? body.detail : t("errorGeneric"));
        } catch {
          setError(t("errorGeneric"));
        }
      }
    };
    xhr.onerror = () => {
      setPhase("failed");
      setError(t("errorGeneric"));
    };
    xhr.send(form);
  };

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragging
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-600">
          <UploadCloud className="size-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-neutral-900">{t("dragDrop")}</p>
        <p className="mt-0.5 text-xs text-neutral-400">{t("or")}</p>
        <span className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700">
          <FileText className="size-3.5" />
          {t("chooseFiles")}
        </span>
        <p className="mt-3 text-xs text-neutral-400">{t("dropzoneHint")}</p>
      </button>

      {/* Selected-file row with progress + status */}
      {file && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-neutral-400">{formatBytes(file.size)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {busy && (
                <span className="text-xs font-medium tabular-nums text-neutral-500">
                  {phase === "processing" ? t("processing") : `${progress}%`}
                </span>
              )}
              {phase === "success" && <CheckCircle2 className="size-5 text-emerald-500" />}
              {phase === "failed" && <AlertCircle className="size-5 text-rose-500" />}
              {!busy && (
                <button
                  type="button"
                  onClick={reset}
                  aria-label={t("clear")}
                  className="grid size-6 place-items-center rounded text-neutral-400 hover:text-neutral-700"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          {(busy || phase === "success") && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={cn(
                  "h-full rounded-full bg-emerald-500 transition-all duration-200",
                  phase === "processing" && progress >= 100 && "animate-pulse"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* Footer: security note (and completion state when done) */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs",
          phase === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-neutral-200 bg-neutral-50 text-neutral-500"
        )}
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0" />
          {securityNote}
        </span>
        {phase === "success" && (
          <span className="flex shrink-0 items-center gap-1.5 font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t("uploadComplete")}
          </span>
        )}
      </div>
    </div>
  );
}
