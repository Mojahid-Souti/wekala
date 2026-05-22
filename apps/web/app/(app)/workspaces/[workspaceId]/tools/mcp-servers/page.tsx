"use client";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [formError, setFormError] = useState("");

  const { data: servers, isLoading } = useQuery({
    queryKey: ["mcp-servers", workspaceId],
    queryFn: () => api.mcpServers.list(workspaceId, token),
    enabled: !!token,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.mcpServers.register(workspaceId, { name, description, url }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", workspaceId] });
      setShowForm(false);
      setName("");
      setDescription("");
      setUrl("");
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
  });

  const deleteMutation = useMutation({
    mutationFn: (serverId: string) => api.mcpServers.delete(workspaceId, serverId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["tools", workspaceId] });
      toast("MCP server removed.", "info");
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
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">MCP servers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Register external Model Context Protocol servers to expose tools to your agents.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={ROUTES.tools(workspaceId)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View tools
          </Link>
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Register MCP server
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleRegister} className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Register a new MCP server</h2>
          {formError && (
            <div
              role="alert"
              className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
            >
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="mcp-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="mcp-url" className="block text-sm font-medium text-gray-700 mb-1">
              Server URL <span className="text-red-500">*</span>
            </label>
            <input
              id="mcp-url"
              type="url"
              required
              placeholder="https://your-mcp-server.example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
            <p className="mt-1 text-xs text-gray-400">
              http/https only. Private, loopback, and cloud-metadata addresses are blocked.
            </p>
          </div>
          <div>
            <label htmlFor="mcp-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="mcp-desc"
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={registerMutation.isPending || !name || !url}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {registerMutation.isPending ? "Registering…" : "Register"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!token || isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : !servers || servers.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-gray-500">
          No MCP servers registered yet.
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <div key={s.id} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{s.name}</h3>
                    {s.is_builtin && (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        built-in
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400 font-mono truncate">{s.url}</p>
                  {s.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{s.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => discoverMutation.mutate(s.id)}
                    disabled={discoverMutation.isPending}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {discoverMutation.isPending ? "…" : "Discover"}
                  </button>
                  {!s.is_builtin && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove MCP server "${s.name}"? Tools and grants will be cleared.`
                          )
                        ) {
                          deleteMutation.mutate(s.id);
                        }
                      }}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
