export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  verify: "/verify",
  resetPassword: "/reset-password",
  dashboard: "/dashboard",
  newWorkspace: "/workspaces/new",
  workspace: (workspaceId: string) => `/workspaces/${workspaceId}`,
  workspaceMembers: (workspaceId: string) => `/workspaces/${workspaceId}/members`,
  agents: (workspaceId: string) => `/workspaces/${workspaceId}/agents`,
  newAgent: (workspaceId: string) => `/workspaces/${workspaceId}/agents/new`,
  agentDetail: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}`,
  agentVetting: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}/vetting`,
  bazaar: "/bazaar",
  bazaarAgent: (agentId: string) => `/bazaar/${agentId}`,
  hired: "/bazaar/hired",
  commandCenter: (workspaceId: string) => `/workspaces/${workspaceId}/command-center`,
  workspaceSettings: (workspaceId: string) => `/workspaces/${workspaceId}/settings`,
  workspaceDeveloper: (workspaceId: string) => `/workspaces/${workspaceId}/settings/developer`,
  tools: (workspaceId: string) => `/workspaces/${workspaceId}/tools`,
  mcpServers: (workspaceId: string) => `/workspaces/${workspaceId}/tools/mcp-servers`,
  agentTools: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}/tools`,
  knowledgeBase: (workspaceId: string) => `/workspaces/${workspaceId}/knowledge-base`,
  kbUpload: (workspaceId: string, kbId: string) =>
    `/workspaces/${workspaceId}/knowledge-base/${kbId}/upload`,
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:8000";

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
