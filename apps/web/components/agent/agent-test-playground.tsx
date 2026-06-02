"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamSSE } from "@/lib/sse";
import { useToken } from "@/lib/use-token";
import { Send, Square } from "lucide-react";
import { useRef, useState } from "react";

type Status = "idle" | "streaming" | "error";

export function AgentTestPlayground({
  workspaceId,
  agentId,
}: {
  workspaceId: string;
  agentId: string;
}) {
  const token = useToken();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (!query.trim() || status === "streaming") return;
    setAnswer("");
    setUsage(null);
    setError("");
    setStatus("streaming");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamSSE(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/test-stream`,
        { query: query.trim() },
        token,
        {
          onToken: (t) => setAnswer((a) => a + t),
          onError: (m) => {
            setError(friendly(m));
            setStatus("error");
          },
          onDone: (u) => {
            // The stream may send a usage `done` then a bare `done`; don't let
            // the empty one clobber the real usage.
            if (Object.keys(u).length > 0) setUsage(u);
            setStatus((s) => (s === "error" ? s : "idle"));
          },
        },
        ctrl.signal
      );
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStatus("idle");
        return;
      }
      setError(friendly(e instanceof Error ? e.message : "Test failed"));
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStatus("idle");
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask the agent something…"
          className="h-10 flex-1 rounded-lg"
        />
        {status === "streaming" ? (
          <Button type="button" variant="outline" className="h-10" onClick={stop}>
            <Square className="size-3.5" /> Stop
          </Button>
        ) : (
          <Button type="submit" className="h-10" disabled={!query.trim()}>
            <Send className="size-3.5" /> Run
          </Button>
        )}
      </form>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </div>
      )}

      {(answer || status === "streaming") && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Response
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
            {answer}
            {status === "streaming" && (
              <span className="ml-0.5 inline-block animate-pulse text-neutral-400">▌</span>
            )}
          </div>
          {usage && Object.keys(usage).length > 0 && (
            <p className="mt-3 border-t border-neutral-100 pt-2 font-mono text-xs text-neutral-400">
              {formatUsage(usage)}
            </p>
          )}
        </div>
      )}

      {status === "idle" && !answer && !error && (
        <p className="text-sm text-neutral-500">
          Sandbox test — counts against your daily quota. Responses stream live from the agent
          runtime.
        </p>
      )}
    </div>
  );
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("quota")) return message; // already a clear quota message
  // Check "definition" before "runtime" — the invalid-definition error also
  // contains the word "runtime".
  if (m.includes("definition") || m.includes("422")) {
    return "This agent's definition can't run — it isn't a valid Dify app. Re-create it from a template, or re-import a valid Dify YAML.";
  }
  if (m.includes("not configured")) {
    return "The agent runtime isn't configured on this environment yet.";
  }
  if (m.includes("unavailable") || m.includes("503")) {
    return "The agent runtime isn't available right now — try Run again in a moment.";
  }
  if (m.includes("no definition") || m.includes("409")) {
    return "This agent has no definition to run yet.";
  }
  return message;
}

function formatUsage(usage: Record<string, unknown>): string {
  // Dify nests usage under metadata.usage; surface the token total if present.
  const u = (usage.usage ?? usage) as Record<string, unknown>;
  const total = u.total_tokens ?? u.total_price;
  return total != null ? `tokens: ${String(total)}` : "done";
}
