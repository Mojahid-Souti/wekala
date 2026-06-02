import { API_URL } from "./constants";

// Minimal SSE-over-fetch reader. We can't use EventSource because it cannot set
// the Authorization header; fetch + a ReadableStream reader gives us auth'd POST
// streaming. Frames are `data: <json>\n\n`; the server sends `{token}`,
// `{done, usage}`, or `{error}` (see api/v1/agents.py test-stream).

export type SSEHandlers = {
  onToken?: (text: string) => void;
  onDone?: (usage: Record<string, unknown>) => void;
  onError?: (message: string) => void;
};

type Frame = { token?: string; done?: boolean; usage?: Record<string, unknown>; error?: string };

/**
 * POST `path` and stream the SSE response, dispatching parsed frames to
 * `handlers`. Pre-stream failures (e.g. 429 quota, 503 runtime) arrive as a
 * normal JSON error response and are thrown with the server's `detail`.
 */
export async function streamSSE(
  path: string,
  body: unknown,
  token: string | undefined,
  handlers: SSEHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}) as { detail?: unknown });
    const detail = (data as { detail?: unknown }).detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line; keep the trailing partial.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice("data:".length).trim();
      if (!payload) continue;
      let evt: Frame;
      try {
        evt = JSON.parse(payload) as Frame;
      } catch {
        continue;
      }
      if (evt.error) handlers.onError?.(evt.error);
      else if (evt.done) handlers.onDone?.(evt.usage ?? {});
      else if (typeof evt.token === "string") handlers.onToken?.(evt.token);
    }
  }
}
