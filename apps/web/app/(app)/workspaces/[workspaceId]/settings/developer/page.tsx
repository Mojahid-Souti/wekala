"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/components/workspace/settings-section";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
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
  const { isAdmin, loading } = useWorkspaceRole(workspaceId);

  // ---- API keys ----
  const { data: keys } = useQuery({
    queryKey: ["api-keys", workspaceId],
    queryFn: () => api.apiKeys.list(workspaceId, token),
    enabled: !!token && isAdmin,
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
    enabled: !!token && isAdmin,
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

  if (!loading && !isAdmin) {
    return (
      <SettingsSection title="Developer" description="API keys and webhooks for this workspace.">
        <p className="text-sm text-neutral-500">
          Only workspace admins can manage developer access.
        </p>
      </SettingsSection>
    );
  }

  return (
    <div>
      <SettingsSection
        title="API keys"
        description="Programmatic access to this workspace. Send as an Authorization: Bearer wk_… header."
      >
        <div className="space-y-4">
          {revealedKey && (
            <output className="block space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Save this key — it won&apos;t be shown again:</p>
              <code className="block break-all rounded border border-amber-200 bg-white p-2 font-mono text-xs">
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
            <Input
              type="text"
              placeholder="Key name (e.g. CI/CD, Test)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="h-10 flex-1 rounded-lg"
            />
            <Button
              onClick={() => createKey.mutate()}
              disabled={createKey.isPending || newKeyName.trim().length < 2}
              className="h-10"
            >
              {createKey.isPending ? "Creating…" : "Create"}
            </Button>
          </div>

          <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
            {keys && keys.length > 0 ? (
              keys.map((k) => (
                <div key={k.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{k.name}</p>
                    <p className="font-mono text-xs text-neutral-500">{k.key_prefix}…</p>
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
                    className="text-xs font-medium text-neutral-500 transition-colors hover:text-rose-600"
                  >
                    Revoke
                  </button>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-neutral-400">No API keys yet.</div>
            )}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Webhooks"
        description="Receive signed (HMAC-SHA256) event callbacks when agents run."
      >
        <div className="space-y-4">
          {revealedSecret && (
            <output className="block space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Signing secret — won&apos;t be shown again:</p>
              <code className="block break-all rounded border border-amber-200 bg-white p-2 font-mono text-xs">
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

          {!showWebhookForm ? (
            <Button onClick={() => setShowWebhookForm(true)} className="h-9">
              Add webhook
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-neutral-200 p-4">
              {whError && (
                <output className="block rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {whError}
                </output>
              )}
              <div className="space-y-1.5">
                <label htmlFor="wh-name" className="block text-xs font-medium text-neutral-700">
                  Name
                </label>
                <Input
                  id="wh-name"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="e.g. Slack notifications"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="wh-url" className="block text-xs font-medium text-neutral-700">
                  URL
                </label>
                <Input
                  id="wh-url"
                  type="url"
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://hooks.example.com/wekala"
                  className="h-10 rounded-lg font-mono"
                />
                <p className="text-xs text-neutral-400">
                  http/https only. Private, loopback, and cloud-metadata addresses are blocked.
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-neutral-700">Events</span>
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
                <Button
                  onClick={() => createWebhook.mutate()}
                  disabled={
                    createWebhook.isPending || whName.length < 2 || !whUrl || whEvents.length === 0
                  }
                  className="h-9"
                >
                  {createWebhook.isPending ? "Creating…" : "Create"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowWebhookForm(false);
                    setWhError("");
                  }}
                  className="h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200">
            {webhooks && webhooks.length > 0 ? (
              webhooks.map((w) => (
                <div key={w.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{w.name}</p>
                      <p className="truncate font-mono text-xs text-neutral-500">{w.url}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span
                            key={e}
                            className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-600"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 font-mono text-xs text-neutral-400">
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
                      className="text-xs font-medium text-neutral-500 transition-colors hover:text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-neutral-400">No webhooks yet.</div>
            )}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
