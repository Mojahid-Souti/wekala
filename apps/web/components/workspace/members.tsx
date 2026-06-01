"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { type MemberOut, api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

// Shared workspace-membership UI. Used by the workspace home (preview) and the
// Settings → Members tab (full management) so the role dropdown, invite form,
// and identity-display rules live in exactly one place.

export const ROLES = ["viewer", "builder", "reviewer", "hirer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { title: string; description: string }> = {
  viewer: { title: "Viewer", description: "Read-only access to workspace content" },
  builder: { title: "Builder", description: "Create and edit agents" },
  reviewer: { title: "Reviewer", description: "Approve or reject vetted agents" },
  hirer: { title: "Hirer", description: "Browse the Bazaar and hire agents" },
  admin: { title: "Admin", description: "Full workspace control" },
};

// --- identity display helpers ------------------------------------------------

/** Best available human label for a member: name → email → shortened id. */
export function memberDisplayName(m: MemberOut): string {
  if (m.full_name?.trim()) return m.full_name.trim();
  if (m.email?.trim()) return m.email.trim();
  return shortenId(m.user_id);
}

/** Two-letter avatar initials from name, else email, else id hex. */
export function memberInitials(m: MemberOut): string {
  const name = m.full_name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase() || name.slice(0, 2).toUpperCase();
  }
  const email = m.email?.trim();
  if (email) return email.slice(0, 2).toUpperCase();
  return m.user_id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function shortenId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

// --- role dropdown -----------------------------------------------------------

export function RoleDropdown({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const current = ROLE_LABELS[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-sm text-neutral-900 transition-colors hover:border-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5 data-[state=open]:border-neutral-900"
        >
          <span className="min-w-0">
            <span className="block font-medium text-neutral-900">{current.title}</span>
            <span className="block truncate text-xs text-neutral-500">{current.description}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-neutral-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] p-1"
      >
        {ROLES.map((r) => {
          const info = ROLE_LABELS[r];
          const isSelected = r === value;
          return (
            <DropdownMenuItem
              key={r}
              onSelect={() => onChange(r)}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 focus:bg-neutral-100"
            >
              <span className="grid size-4 shrink-0 place-items-center pt-0.5">
                {isSelected && <Check className="size-3.5 text-neutral-900" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-900">{info.title}</span>
                <span className="block text-xs text-neutral-500">{info.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RoleChip({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
      {role}
    </span>
  );
}

// --- invite form -------------------------------------------------------------

export function InviteMemberForm({
  workspaceId,
  onInvited,
}: {
  workspaceId: string;
  onInvited?: () => void;
}) {
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [error, setError] = useState("");

  const invite = useMutation({
    mutationFn: async () => {
      const user = await api.users.lookup(email, token);
      return api.workspaces.members.invite(workspaceId, user.id, role, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      setEmail("");
      setError("");
      toast("Member invited.", "success");
      onInvited?.();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Invite failed"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    invite.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-900">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <label
          htmlFor="invite-email"
          className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
        >
          Email address
        </label>
        <Input
          id="invite-email"
          type="email"
          required
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-lg"
        />
      </div>
      <div className="space-y-1.5">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Role
        </span>
        <RoleDropdown value={role} onChange={setRole} />
      </div>
      <Button type="submit" disabled={invite.isPending || !email} className="h-10 w-full">
        {invite.isPending && <Loader2 className="size-3.5 animate-spin" />}
        {invite.isPending ? "Inviting…" : "Send invite"}
      </Button>
    </form>
  );
}

// --- member list (full management) -------------------------------------------

export function MemberList({
  workspaceId,
  canManage,
  currentUserId,
}: {
  workspaceId: string;
  canManage: boolean;
  currentUserId?: string | null;
}) {
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => api.workspaces.members.list(workspaceId, token),
    enabled: !!token,
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.workspaces.members.remove(workspaceId, userId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
      toast("Member removed.", "info");
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Remove failed", "error"),
  });

  if (isLoading || !token) {
    return <div className="px-5 py-8 text-sm text-neutral-400">Loading members…</div>;
  }
  if (!members || members.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-neutral-500">
        No members yet — invite someone to get started.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {members.map((m) => {
        const isSelf = currentUserId === m.user_id;
        const hasName = !!(m.full_name?.trim() && m.email?.trim());
        return (
          <li key={m.user_id} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-neutral-100 text-xs font-medium text-neutral-700">
                  {memberInitials(m)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-neutral-900">
                  {memberDisplayName(m)}
                  {isSelf && <span className="text-xs font-normal text-neutral-400">You</span>}
                </p>
                {hasName && <p className="truncate text-xs text-neutral-500">{m.email}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <RoleChip role={m.role} />
              {canManage && !isSelf && (
                <button
                  type="button"
                  onClick={() => remove.mutate(m.user_id)}
                  disabled={remove.isPending}
                  className="text-xs font-medium text-neutral-500 transition-colors hover:text-rose-600 disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
