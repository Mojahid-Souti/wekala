"use client";

import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

const DEFAULT_EVENTS = ["agent.invoked", "agent.completed", "agent.failed"];

export default function DeveloperSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ---- API keys ----
  const { data: keys } = useQuery({
    queryKey: ["api-keys", workspaceId],
    queryFn: () => api.apiKeys.list(workspaceId, token),
    enabled: !!token,
  });
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const createKey = useMutation({
    mutationFn: () => api.apiKeys.create(workspaceId, newKeyName, token),
    onSuccess: (out) => {
      qc.invalidateQueries({ queryKey: ["api-keys", workspaceId] });
      setRevealedKey(out.key);
      setNewKeyName("");
      toast("API key created. Copy it now — it won't be shown again.", "success");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Create failed", "error"),
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api.apiKeys.revoke(workspaceId, id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys", workspaceId] });
      toast("API key revoked.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Revoke failed", "error"),
  });

  // ---- Webhooks ----
  const { data: webhooks } = useQuery({
    queryKey: ["webhooks", workspaceId],
    queryFn: () => api.webhooks.list(workspaceId, token),
    enabled: !!token,
  });
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>(DEFAULT_EVENTS);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [whError, setWhError] = useState("");

  const createWebhook = useMutation({
    mutationFn: () =>
      api.webhooks.create(workspaceId, { name: whName, url: whUrl, events: whEvents }, token),
    onSuccess: (out) => {
      qc.invalidateQueries({ queryKey: ["webhooks", workspaceId] });
      setRevealedSecret(out.secret);
      setWhName("");
      setWhUrl("");
      setWhEvents(DEFAULT_EVENTS);
      setShowWebhookForm(false);
      setWhError("");
      toast("Webhook created. Copy the signing secret — shown once.", "success");
    },
    onError: (e) => setWhError(e instanceof Error ? e.message : "Create failed"),
  });
  const deleteWebhook = useMutation({
    mutationFn: (id: string) => api.webhooks.delete(workspaceId, id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks", workspaceId] });
      toast("Webhook removed.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Developer</h1>
        <p className="mt-1 text-sm text-gray-500">
          API keys and webhook subscriptions for external integrations.
        </p>
      </div>

      {/* API keys */}
      <section className="rounded-lg border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">API keys</h2>
          <span className="text-xs text-gray-400">
            Pass as <code className="font-mono">Authorization: Bearer wk_…</code>
          </span>
        </div>

        {revealedKey && (
          <output className="block rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Save this key — it won&apos;t be shown again:</p>
            <code className="block font-mono text-xs break-all bg-white border border-amber-200 rounded p-2">
              {revealedKey}
            </code>
            <button
              type="button"
              onClick={() => setRevealedKey(null)}
              className="text-xs underline"
            >
              I&apos;ve saved it
            </button>
          </output>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Key name (e.g. CI/CD, Test)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => createKey.mutate()}
            disabled={createKey.isPending || newKeyName.trim().length < 2}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {createKey.isPending ? "Creating…" : "Create"}
          </button>
        </div>

        <div className="rounded-lg border bg-white divide-y overflow-hidden">
          {keys && keys.length > 0 ? (
            keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{k.key_prefix}…</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Revoke "${k.name}"? Existing requests using this key will start failing immediately.`
                      )
                    ) {
                      revokeKey.mutate(k.id);
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Revoke
                </button>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400">No API keys yet.</div>
          )}
        </div>
      </section>

      {/* Webhooks */}
      <section className="rounded-lg border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Webhooks</h2>
          {!showWebhookForm && (
            <button
              type="button"
              onClick={() => setShowWebhookForm(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add webhook
            </button>
          )}
        </div>

        {revealedSecret && (
          <output className="block rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Signing secret — won&apos;t be shown again:</p>
            <code className="block font-mono text-xs break-all bg-white border border-amber-200 rounded p-2">
              {revealedSecret}
            </code>
            <p className="text-xs">
              Verify deliveries with HMAC-SHA256 over the raw body. Header:{" "}
              <code className="font-mono">X-Wekala-Signature: sha256=…</code>
            </p>
            <button
              type="button"
              onClick={() => setRevealedSecret(null)}
              className="text-xs underline"
            >
              I&apos;ve saved it
            </button>
          </output>
        )}

        {showWebhookForm && (
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            {whError && (
              <output className="block rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
                {whError}
              </output>
            )}
            <div>
              <label htmlFor="wh-name" className="block text-xs font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="wh-name"
                type="text"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="e.g. Slack notifications"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="wh-url" className="block text-xs font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                id="wh-url"
                type="url"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://hooks.example.com/wekala"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                http/https only. Private, loopback, and cloud-metadata addresses are blocked.
              </p>
            </div>
            <div>
              <span className="block text-xs font-medium text-gray-700 mb-1">Events</span>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={whEvents.includes(ev)}
                      onChange={(e) => {
                        setWhEvents(
                          e.target.checked ? [...whEvents, ev] : whEvents.filter((x) => x !== ev)
                        );
                      }}
                    />
                    <span className="font-mono text-xs">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => createWebhook.mutate()}
                disabled={
                  createWebhook.isPending || whName.length < 2 || !whUrl || whEvents.length === 0
                }
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {createWebhook.isPending ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWebhookForm(false);
                  setWhError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-white divide-y overflow-hidden">
          {webhooks && webhooks.length > 0 ? (
            webhooks.map((w) => (
              <div key={w.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{w.name}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{w.url}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-mono"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-400 font-mono">
                      secret: {w.secret_prefix}…
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete webhook "${w.name}"?`)) {
                        deleteWebhook.mutate(w.id);
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400">No webhooks yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
