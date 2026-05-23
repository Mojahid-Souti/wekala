"use client";

import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

const ROLES = ["viewer", "hirer", "reviewer", "builder", "admin"] as const;
type Role = (typeof ROLES)[number];

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviteError, setInviteError] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => api.workspaces.members.list(workspaceId, token),
    enabled: !!token,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const user = await api.users.lookup(inviteEmail, token);
      return api.workspaces.members.invite(workspaceId, user.id, inviteRole, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      setInviteEmail("");
      setInviteError("");
      toast("Member invited.", "success");
    },
    onError: (e) => setInviteError(e instanceof Error ? e.message : "Invite failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.workspaces.members.remove(workspaceId, userId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      toast("Member removed.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Remove failed", "error"),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    inviteMutation.mutate();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
        <p className="mt-1 text-sm text-gray-500">
          Invite teammates to this workspace and manage their roles.
        </p>
      </div>

      <section className="rounded-lg border bg-white">
        {!token || isLoading ? (
          <div className="px-4 py-3 text-sm text-gray-400 animate-pulse">Loading…</div>
        ) : members && members.length > 0 ? (
          <div className="divide-y">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-gray-900 truncate">{m.user_id}</p>
                  <p className="mt-0.5 text-xs text-gray-500 capitalize">{m.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove this member from the workspace?")) {
                      removeMutation.mutate(m.user_id);
                    }
                  }}
                  disabled={removeMutation.isPending}
                  className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3 text-sm text-gray-400">No members yet.</div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Invite by email
        </h2>
        {inviteError && (
          <output className="block rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
            {inviteError}
          </output>
        )}
        <form onSubmit={handleInvite} className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="invite-email" className="block text-xs font-medium text-gray-600 mb-1">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              required
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-xs font-medium text-gray-600 mb-1">
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="self-end">
            <button
              type="submit"
              disabled={inviteMutation.isPending || !inviteEmail}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {inviteMutation.isPending ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
