"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSection } from "@/components/workspace/settings-section";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function GeneralSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin } = useWorkspaceRole(workspaceId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

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

  const update = useMutation({
    mutationFn: () => api.workspaces.update(workspaceId, name, description, token),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast(`Workspace "${updated.name}" updated.`, "success");
      setError("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Update failed"),
  });

  if (isLoading || !token) {
    return (
      <div className="h-48 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
    );
  }

  const hasChanges =
    workspace && (name !== workspace.name || description !== (workspace.description ?? ""));
  const canSave = !!(isAdmin && hasChanges && name.trim().length >= 2 && !update.isPending);

  return (
    <SettingsSection title="General" description="Your workspace's name and description.">
      {!isAdmin && (
        <p className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          Only workspace admins can change these settings.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) update.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="ws-name"
            className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
          >
            Workspace name
          </label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            required
            minLength={2}
            maxLength={100}
            className="h-10 rounded-lg"
          />
          <p className="text-xs text-neutral-400">
            Slug: <span className="font-mono">{workspace?.slug}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="ws-desc"
            className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
          >
            Description
          </label>
          <Textarea
            id="ws-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isAdmin}
            rows={3}
            maxLength={500}
            className="resize-none rounded-lg"
          />
          <p className="text-xs text-neutral-400">{description.length}/500</p>
        </div>

        {isAdmin && (
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={!canSave} className="h-10">
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            {hasChanges && (
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => {
                  setName(workspace?.name ?? "");
                  setDescription(workspace?.description ?? "");
                  setError("");
                }}
              >
                Discard
              </Button>
            )}
          </div>
        )}
      </form>
    </SettingsSection>
  );
}
