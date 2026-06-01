"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection } from "@/components/workspace/settings-section";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function DangerZonePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isAdmin, loading } = useWorkspaceRole(workspaceId);
  const [confirmName, setConfirmName] = useState("");

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.workspaces.get(workspaceId, token),
    enabled: !!token,
  });

  const del = useMutation({
    mutationFn: () => api.workspaces.delete(workspaceId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast("Workspace deleted.", "success");
      router.push(ROUTES.dashboard);
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Delete failed", "error"),
  });

  if (!loading && !isAdmin) {
    return (
      <SettingsSection title="Danger zone" description="Irreversible actions for this workspace.">
        <p className="text-sm text-neutral-500">Only workspace admins can access this section.</p>
      </SettingsSection>
    );
  }

  const canDelete = confirmName.trim() === workspace?.name && !del.isPending;

  return (
    <SettingsSection
      title="Danger zone"
      description="Irreversible actions. Proceed with care — there is no undo."
    >
      <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <div>
          <h3 className="text-sm font-semibold text-rose-700">Delete this workspace</h3>
          <p className="mt-0.5 text-sm text-neutral-600">
            Permanently removes all agents, knowledge bases, members, and audit history.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-name" className="block text-sm text-neutral-700">
            Type <span className="font-mono font-semibold text-neutral-900">{workspace?.name}</span>{" "}
            to confirm:
          </label>
          <Input
            id="confirm-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={workspace?.name}
            className="h-10 max-w-sm rounded-lg bg-white"
          />
        </div>

        <Button
          variant="destructive"
          disabled={!canDelete}
          onClick={() => del.mutate()}
          className="h-10"
        >
          {del.isPending ? "Deleting…" : "Delete this workspace"}
        </Button>
      </div>
    </SettingsSection>
  );
}
