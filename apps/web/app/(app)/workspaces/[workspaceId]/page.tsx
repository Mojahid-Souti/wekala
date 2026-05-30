"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  FileUp,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const ROLES = ["viewer", "builder", "reviewer", "hirer", "admin"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, { title: string; description: string }> = {
  viewer: { title: "Viewer", description: "Read-only access to workspace content" },
  builder: { title: "Builder", description: "Create and edit agents" },
  reviewer: { title: "Reviewer", description: "Approve or reject vetted agents" },
  hirer: { title: "Hirer", description: "Browse the Bazaar and hire agents" },
  admin: { title: "Admin", description: "Full workspace control" },
};

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

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    inviteMutation.mutate();
  }

  if (!token || wsLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-8 px-5 py-6 lg:px-7">
        <div className="h-9 w-72 animate-pulse rounded-md bg-neutral-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-5 py-6 lg:px-7">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
          {workspace?.name ?? "—"}
        </h1>
        <p className="text-sm text-neutral-500">
          {workspace?.description ??
            "Your workspace home — manage agents, knowledge bases, and team members."}
        </p>
      </header>

      {/* Stat tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Wand2 className="size-4" />}
          label="Agents"
          value={agents?.total ?? 0}
          href={ROUTES.agents(workspaceId)}
        />
        <StatTile
          icon={<Users className="size-4" />}
          label="Members"
          value={members?.length ?? 0}
          loading={membersLoading}
          href={ROUTES.workspaceMembers(workspaceId)}
        />
        <StatTile
          icon={<ShieldCheck className="size-4" />}
          label="Knowledge bases"
          value={null}
          href={ROUTES.knowledgeBase(workspaceId)}
        />
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionTile
            href={ROUTES.newAgent(workspaceId)}
            icon={<Plus className="size-4" />}
            title="New agent"
            description="Build from a template, paste YAML, or chat-to-build."
            primary
          />
          <ActionTile
            href={ROUTES.knowledgeBase(workspaceId)}
            icon={<FileUp className="size-4" />}
            title="Upload documents"
            description="Ground agent responses in your workspace's knowledge."
          />
          <ActionTile
            href={ROUTES.bazaar}
            icon={<Compass className="size-4" />}
            title="Browse Bazaar"
            description="Hire pre-vetted agents the team has shipped."
          />
        </div>
      </section>

      {/* Members + invite — side-by-side at lg, stacked below. */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Members list */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Members ({members?.length ?? 0})
            </h2>
            <Link
              href={ROUTES.workspaceMembers(workspaceId)}
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-900"
            >
              Manage all
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {membersLoading ? (
              <div className="px-5 py-4 text-sm text-neutral-400">Loading members…</div>
            ) : members && members.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {members.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-neutral-100 text-xs font-medium text-neutral-700">
                          {initials(m.user_id)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-neutral-700">
                          {shortenId(m.user_id)}
                        </p>
                        <RoleChip role={m.role} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(m.user_id)}
                      disabled={removeMutation.isPending}
                      className="text-xs font-medium text-neutral-500 transition-colors hover:text-rose-600 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center text-sm text-neutral-500">
                No members yet — invite someone to get started.
              </div>
            )}
          </div>
        </div>

        {/* Invite form */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Invite a member
          </h2>
          <form
            onSubmit={handleInvite}
            className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5"
          >
            {inviteError && (
              <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-900">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="invite-email"
                className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500"
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
                className="block w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/5"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Role
              </span>
              <RoleDropdown value={inviteRole} onChange={setInviteRole} />
            </div>
            <button
              type="submit"
              disabled={inviteMutation.isPending || !inviteEmail}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {inviteMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              {inviteMutation.isPending ? "Inviting…" : "Send invite"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(uuid: string): string {
  // UUIDs aren't names, but the first two hex chars are stable per user and
  // give the avatar visual variety. Cheap, until the backend ships an email
  // on the members payload (one-line backend change, separate task).
  return uuid
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

function shortenId(uuid: string): string {
  if (uuid.length <= 16) return uuid;
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
}

function StatTile({
  icon,
  label,
  value,
  loading,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  loading?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 transition-all hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
          {icon}
        </span>
        <ArrowRight className="size-3.5 text-neutral-300 transition-colors group-hover:text-neutral-700" />
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-12 animate-pulse rounded bg-neutral-100" />
        ) : (
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-neutral-950">
            {value !== null ? value : "—"}
          </p>
        )}
      </div>
    </Link>
  );
}

function ActionTile({
  href,
  icon,
  title,
  description,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border p-4 transition-all",
        primary
          ? "border-neutral-900 bg-neutral-950 text-white hover:bg-neutral-800"
          : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:shadow-sm"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg",
            primary ? "bg-white/15 text-white" : "bg-neutral-100 text-neutral-700"
          )}
        >
          {icon}
        </span>
        <ArrowRight
          className={cn(
            "size-3.5 transition-colors",
            primary
              ? "text-white/50 group-hover:text-white"
              : "text-neutral-300 group-hover:text-neutral-700"
          )}
        />
      </div>
      <p className={cn("text-sm font-semibold", primary ? "text-white" : "text-neutral-900")}>
        {title}
      </p>
      <p className={cn("text-xs leading-relaxed", primary ? "text-white/70" : "text-neutral-500")}>
        {description}
      </p>
    </Link>
  );
}

function RoleChip({ role }: { role: string }) {
  return (
    <span className="mt-0.5 inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
      {role}
    </span>
  );
}

function RoleDropdown({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
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
