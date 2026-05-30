"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type MCPServerOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Lock, Plug, RefreshCw, Server, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function MCPServersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MCPServerOut | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  const { data: servers, isLoading } = useQuery({
    queryKey: ["mcp-servers", workspaceId],
    queryFn: () => api.mcpServers.list(workspaceId, token),
    enabled: !!token,
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      api.mcpServers.register(
        workspaceId,
        { name, description, url, auth_token: authToken.trim() || undefined },
        token
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", workspaceId] });
      setShowForm(false);
      setName("");
      setDescription("");
      setUrl("");
      setAuthToken("");
      setFormError("");
      toast("MCP server registered. Run discovery to load its tools.", "success");
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Registration failed");
    },
  });

  const discoverMutation = useMutation({
    mutationFn: (serverId: string) => api.mcpServers.discover(workspaceId, serverId, token),
    onSuccess: (tools) => {
      queryClient.invalidateQueries({ queryKey: ["tools", workspaceId] });
      toast(
        `Discovery succeeded — ${tools.length} tool${tools.length === 1 ? "" : "s"} found.`,
        "success"
      );
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : "Discovery failed", "error");
    },
    onSettled: () => setDiscoveringId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (serverId: string) => api.mcpServers.delete(workspaceId, serverId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["tools", workspaceId] });
      toast("MCP server removed.", "info");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    },
  });

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    registerMutation.mutate();
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">MCP servers</h1>
          <p className="text-sm text-neutral-500">
            Register external Model Context Protocol servers to expose their tools to your agents.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={ROUTES.tools(workspaceId)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          >
            <Wrench className="size-4" />
            View tools
          </Link>
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setShowForm(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <Plug className="size-4" />
            Register server
          </button>
        </div>
      </header>

      {/* Server list */}
      {!token || isLoading ? (
        <div className="space-y-3">
          {["a", "b"].map((k) => (
            <div
              key={`srv-skel-${k}`}
              className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      ) : !servers || servers.length === 0 ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center">
          <div className="grid size-12 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-400">
            <Server className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-neutral-950">No MCP servers yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-neutral-500">
            Register a server to discover its tools and grant them to your agents.
          </p>
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setShowForm(true);
            }}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <Plug className="size-4" />
            Register server
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
                    <Server className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{s.name}</h3>
                      {s.is_builtin && (
                        <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                          built-in
                        </span>
                      )}
                      <StatusBadge status={s.status} />
                      {s.has_auth && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                          <Lock className="size-3" />
                          authenticated
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-neutral-400" title={s.url}>
                      {s.url}
                    </p>
                    {s.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{s.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDiscoveringId(s.id);
                      discoverMutation.mutate(s.id);
                    }}
                    disabled={discoveringId === s.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 disabled:opacity-50"
                  >
                    {discoveringId === s.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Discover
                  </button>
                  {!s.is_builtin && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(s)}
                      aria-label={`Remove ${s.name}`}
                      className="grid size-8 place-items-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register a new MCP server</DialogTitle>
            <DialogDescription>
              Connect a Model Context Protocol server so its tools appear in your catalog.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            {formError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {formError}
              </p>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="mcp-name"
                className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="mcp-name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. HR Documents"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="mcp-url"
                className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                Server URL <span className="text-rose-500">*</span>
              </label>
              <input
                id="mcp-url"
                type="url"
                required
                placeholder="https://your-mcp-server.example.com/mcp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
              <p className="text-xs text-neutral-400">
                http/https only. Private, loopback, and cloud-metadata addresses are blocked.
              </p>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="mcp-desc"
                className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                Description
              </label>
              <textarea
                id="mcp-desc"
                rows={2}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full resize-none rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="mcp-auth"
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500"
              >
                <KeyRound className="size-3.5" />
                Auth token{" "}
                <span className="lowercase tracking-normal text-neutral-400">(optional)</span>
              </label>
              <input
                id="mcp-auth"
                type="password"
                autoComplete="off"
                placeholder="e.g. hf_xxx — sent as Authorization: Bearer …"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
              <p className="text-xs text-neutral-400">
                Stored encrypted and never shown again. Use for servers that need a bearer token or
                API key (e.g. Hugging Face).
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError("");
                }}
                className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={registerMutation.isPending || !name || !url}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {registerMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                {registerMutation.isPending ? "Registering…" : "Register"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove MCP server</DialogTitle>
            <DialogDescription>
              Its discovered tools and any agent grants will be cleared. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              {deleteTarget.name}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="inline-flex h-9 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {deleteMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Remove
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-500"
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-neutral-400")} />
      {status}
    </span>
  );
}
