"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleChip, memberDisplayName, memberInitials } from "@/components/workspace/members";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Compass, FileUp, Plus, ShieldCheck, Users, Wand2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WorkspaceHomePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const token = useToken();

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

  const memberCount = members?.length ?? 0;
  const previewMembers = members?.slice(0, 6) ?? [];

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
          value={memberCount}
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

      {/* Members preview — full management lives under Settings → Members. */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Members ({memberCount})
          </h2>
          <Link
            href={ROUTES.workspaceMembers(workspaceId)}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:text-neutral-900"
          >
            Manage members
            <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {membersLoading ? (
            <div className="px-5 py-4 text-sm text-neutral-400">Loading members…</div>
          ) : previewMembers.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {previewMembers.map((m) => {
                const hasName = !!(m.full_name?.trim() && m.email?.trim());
                return (
                  <li key={m.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-neutral-100 text-xs font-medium text-neutral-700">
                          {memberInitials(m)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {memberDisplayName(m)}
                        </p>
                        {hasName && <p className="truncate text-xs text-neutral-500">{m.email}</p>}
                      </div>
                    </div>
                    <RoleChip role={m.role} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-neutral-500">
              No members yet — invite someone from Settings → Members.
            </div>
          )}
        </div>
        {memberCount > previewMembers.length && (
          <p className="text-xs text-neutral-400">
            Showing {previewMembers.length} of {memberCount}.{" "}
            <Link
              href={ROUTES.workspaceMembers(workspaceId)}
              className="font-medium text-neutral-600 hover:text-neutral-900"
            >
              View all
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
