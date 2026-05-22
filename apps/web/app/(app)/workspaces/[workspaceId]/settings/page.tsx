"use client";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.workspaces.get(workspaceId, token),
    enabled: !!token,
  });

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description ?? "");
    }
  }, [workspace]);

  const updateMutation = useMutation({
    mutationFn: () => api.workspaces.update(workspaceId, name, description, token),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast(`Workspace "${updated.name}" updated.`, "success");
      setEditError("");
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.workspaces.delete(workspaceId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast("Workspace deleted.", "success");
      router.push(ROUTES.dashboard);
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    },
  });

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    updateMutation.mutate();
  }

  function handleDelete() {
    if (deleteConfirmName !== workspace?.name) {
      toast("Type the workspace name exactly to confirm.", "error");
      return;
    }
    deleteMutation.mutate();
  }

  if (!token || isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-32 rounded bg-gray-100" />
      </div>
    );
  }

  const hasChanges =
    workspace && (name !== workspace.name || description !== (workspace.description ?? ""));

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Workspace settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your workspace name, description, and lifecycle.
        </p>
      </div>

      {/* Edit form */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">General</h2>

        {editError && (
          <div
            role="alert"
            className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
          >
            {editError}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1">
              Workspace name
            </label>
            <input
              id="ws-name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">
              Slug: <span className="font-mono">{workspace?.slug}</span>
            </p>
          </div>

          <div>
            <label htmlFor="ws-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="ws-desc"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">{description.length}/500</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!hasChanges || updateMutation.isPending || name.trim().length < 2}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={() => {
                  setName(workspace?.name ?? "");
                  setDescription(workspace?.description ?? "");
                  setEditError("");
                }}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Discard
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">Danger zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Deleting a workspace permanently removes all its agents, knowledge bases, members, and
          audit history. This cannot be undone.
        </p>

        {!showDeleteSection ? (
          <button
            type="button"
            onClick={() => setShowDeleteSection(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
          >
            Delete this workspace
          </button>
        ) : (
          <div className="rounded-lg bg-red-50 p-4 space-y-3 border border-red-200">
            <p className="text-sm text-red-800">
              To confirm, type <span className="font-mono font-semibold">{workspace?.name}</span>{" "}
              below:
            </p>
            <input
              type="text"
              placeholder={workspace?.name}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteConfirmName !== workspace?.name || deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteMutation.isPending ? "Deleting…" : "I understand, delete it"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteSection(false);
                  setDeleteConfirmName("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
