import { API_URL } from "./constants";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type AgentOut = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  owner_id: string;
  tags: string[];
  status: string;
  version: number;
  language: string;
  classification: string;
  dify_app_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentVersionOut = {
  id: string;
  agent_id: string;
  version_num: number;
  name: string;
  description: string;
  changed_by: string;
  change_note: string;
  created_at: string;
};

export type TemplateOut = {
  id: string;
  name: string;
  description: string;
};

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      request("/v1/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      request<{ access_token: string; refresh_token: string; user: { id: string; email: string } }>(
        "/v1/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),
    resetPassword: (email: string) =>
      request("/v1/auth/reset-password", { method: "POST", body: JSON.stringify({ email }) }),
    me: (token: string) => request("/v1/auth/me", {}, token),
  },
  workspaces: {
    create: (name: string, token: string) =>
      request("/v1/workspaces", { method: "POST", body: JSON.stringify({ name }) }, token),
    list: (token: string) =>
      request<{ id: string; name: string; slug: string }[]>("/v1/workspaces", {}, token),
  },
  agents: {
    list: (workspaceId: string, token: string, statusFilter?: string) => {
      const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
      return request<{ items: AgentOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/agents${qs}`,
        {},
        token
      );
    },
    get: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(`/v1/workspaces/${workspaceId}/agents/${agentId}`, {}, token),
    importYaml: (workspaceId: string, file: File, token: string) => {
      const form = new FormData();
      form.append("file", file);
      return request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agent-imports`,
        { method: "POST", body: form, headers: {} },
        token
      );
    },
    importTemplate: (workspaceId: string, templateId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agent-imports/template`,
        { method: "POST", body: JSON.stringify({ template_id: templateId }) },
        token
      ),
    publish: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/publish`,
        { method: "POST" },
        token
      ),
    archive: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/archive`,
        { method: "POST" },
        token
      ),
    clone: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/clone`,
        { method: "POST" },
        token
      ),
    versions: (workspaceId: string, agentId: string, token: string) =>
      request<AgentVersionOut[]>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/versions`,
        {},
        token
      ),
    rollback: (workspaceId: string, agentId: string, versionNum: number, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/versions/${versionNum}/rollback`,
        { method: "POST" },
        token
      ),
    test: (workspaceId: string, agentId: string, query: string, token: string) =>
      request<{ answer: string; usage: Record<string, unknown> }>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/test`,
        { method: "POST", body: JSON.stringify({ query }) },
        token
      ),
  },
  templates: {
    list: (token: string) => request<TemplateOut[]>("/v1/templates", {}, token),
  },
};
