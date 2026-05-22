"use client";

import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const ROLES = ["viewer", "builder", "reviewer", "hirer", "admin"] as const;
type Role = (typeof ROLES)[number];

export default function WorkspaceHomePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviteError, setInviteError] = useState("");

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.workspaces.get(workspaceId, token),
    enabled: !!token,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => api.workspaces.members.list(workspaceId, token),
    enabled: !!token,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents", workspaceId],
    queryFn: () => api.agents.list(workspaceId, token),
    enabled: !!token,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const user = await api.users.lookup(inviteEmail, token);
      return api.workspaces.members.invite(workspaceId, user.id, inviteRole, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      setInviteEmail("");
      setInviteError("");
      toast("Member invited successfully", "success");
    },
    onError: (err) => {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.workspaces.members.remove(workspaceId, userId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      toast("Member removed", "info");
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : "Remove failed", "error");
    },
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    inviteMutation.mutate();
  }

  if (!token || wsLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-96 rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Workspace header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{workspace?.name ?? "—"}</h1>
        {workspace?.description && (
          <p className="mt-1 text-sm text-gray-500">{workspace.description}</p>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Agents"
          value={agents?.total ?? 0}
          href={ROUTES.agents(workspaceId)}
          loading={!agents}
        />
        <StatCard
          label="Members"
          value={members?.length ?? 0}
          href={ROUTES.workspaceMembers(workspaceId)}
          loading={membersLoading}
        />
        <StatCard
          label="Knowledge Bases"
          value={null}
          href={ROUTES.knowledgeBase(workspaceId)}
          loading={false}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={ROUTES.newAgent(workspaceId)}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            + New agent
          </Link>
          <Link
            href={ROUTES.knowledgeBase(workspaceId)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Upload documents
          </Link>
          <Link
            href={ROUTES.bazaar}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Browse Bazaar
          </Link>
        </div>
      </div>

      {/* Members */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Members
        </h2>
        <div className="rounded-lg border bg-white divide-y overflow-hidden">
          {membersLoading ? (
            <div className="px-4 py-3 text-sm text-gray-400 animate-pulse">Loading members…</div>
          ) : members && members.length > 0 ? (
            members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 font-mono">{m.user_id}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{m.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(m.user_id)}
                  disabled={removeMutation.isPending}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400">No members yet.</div>
          )}
        </div>
      </div>

      {/* Invite form */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Invite a member
        </h2>
        <form onSubmit={handleInvite} className="rounded-lg border bg-white p-4 space-y-4">
          {inviteError && (
            <div
              role="alert"
              className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
            >
              {inviteError}
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor="invite-email"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                required
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={inviteMutation.isPending || !inviteEmail}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {inviteMutation.isPending ? "Inviting…" : "Send invite"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  loading,
}: {
  label: string;
  value: number | null;
  href: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="mt-1 h-7 w-10 rounded bg-gray-200 animate-pulse" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value !== null ? value : "—"}</p>
      )}
    </Link>
  );
}
