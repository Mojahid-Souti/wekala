"use client";

import type { KBUploadAcceptedOut } from "@/lib/api";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

type Props = {
  workspaceId: string;
  kbId: string;
  token: string;
  onUploaded: (result: KBUploadAcceptedOut) => void;
};

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".html"];

export function UploadForm({ workspaceId, kbId, token, onUploaded }: Props) {
  const t = useTranslations("knowledgeBase.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const validateFile = (f: File): string | null => {
    if (f.size > 50 * 1024 * 1024) return t("errorFileTooLarge");
    const ext = `.${f.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) return t("errorFileType");
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
    } else {
      setError(null);
      setFile(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.kb.uploadDocument(workspaceId, kbId, file, token);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label
        htmlFor="kb-file-input"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`block cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400"}`}
      >
        <input
          id="kb-file-input"
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {file ? (
          <p className="font-medium text-gray-800">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">{t("dropzone")}</p>
            <p className="mt-1 text-xs text-gray-400">{t("dropzoneHint")}</p>
          </>
        )}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!file || uploading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {uploading ? t("uploading") : t("uploadButton")}
      </button>
    </form>
  );
}
