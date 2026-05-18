export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  verify: "/verify",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  newWorkspace: "/workspaces/new",
  agents: (workspaceId: string) => `/workspaces/${workspaceId}/agents`,
  newAgent: (workspaceId: string) => `/workspaces/${workspaceId}/agents/new`,
  agentDetail: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}`,
  bazaar: "/bazaar",
  bazaarAgent: (agentId: string) => `/bazaar/${agentId}`,
  hired: "/bazaar/hired",
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:8000";

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
