"use client";

import { api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";

type Me = { id: string; email: string };

/**
 * The current user's role in a workspace, derived from the members list + the
 * authenticated identity. UI-only gating — the server (OPA + RLS) remains the
 * real authorization boundary. Reuses the shared "workspace-members" query
 * cache, so it's free when a members list is already mounted.
 */
export function useWorkspaceRole(workspaceId: string): {
  userId: string | null;
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
} {
  const token = useToken();

  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => api.auth.me(token) as Promise<Me>,
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  const { data: members } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => api.workspaces.members.list(workspaceId, token),
    enabled: !!token,
  });

  const userId = me?.id ?? null;
  const role = userId ? (members?.find((m) => m.user_id === userId)?.role ?? null) : null;

  return {
    userId,
    role,
    isAdmin: role === "admin",
    loading: !me || !members,
  };
}
