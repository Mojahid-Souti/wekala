export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  verify: "/verify",
  resetPassword: "/reset-password",
  newPassword: "/reset-password/new",
  dashboard: "/dashboard",
  newWorkspace: "/workspaces/new",
  workspace: (workspaceId: string) => `/workspaces/${workspaceId}`,
  // Members live under the Settings tabs now. The legacy /members route still
  // exists as a redirect for stale links/bookmarks.
  workspaceMembers: (workspaceId: string) => `/workspaces/${workspaceId}/settings/members`,
  agents: (workspaceId: string) => `/workspaces/${workspaceId}/agents`,
  // "New agent" now lands on the templates picker (polished UI). The
  // legacy /agents/new route still exists as a redirect for stale links.
  newAgent: (workspaceId: string) => `/workspaces/${workspaceId}/agents/templates`,
  agentsBuild: (workspaceId: string) => `/workspaces/${workspaceId}/agents/build`,
  agentsTemplates: (workspaceId: string) => `/workspaces/${workspaceId}/agents/templates`,
  agentsImport: (workspaceId: string) => `/workspaces/${workspaceId}/agents/import`,
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
  workspaceDanger: (workspaceId: string) => `/workspaces/${workspaceId}/settings/danger`,
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
