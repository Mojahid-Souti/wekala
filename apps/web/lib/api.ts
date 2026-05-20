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

export type BazaarAgentOut = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: string;
  language: string;
  classification: string;
  owner_id: string;
  workspace_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  hired: boolean;
  rating?: { avg: number | null; count: number };
  category_ids?: string[];
};

export type CategoryOut = {
  id: string;
  name: string;
  slug: string;
};

export type ReviewOut = {
  id: string;
  author_id: string;
  rating: number;
  body: string;
  created_at: string;
};

export type HireOut = {
  id: string;
  workspace_id: string;
  agent_id: string;
  hired_at: string;
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
  bazaar: {
    list: (
      workspaceId: string,
      token: string,
      opts: { q?: string; cat?: string[]; page?: number; size?: number } = {}
    ) => {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (opts.q) params.set("q", opts.q);
      if (opts.cat?.length) for (const c of opts.cat) params.append("cat", c);
      if (opts.page) params.set("page", String(opts.page));
      if (opts.size) params.set("size", String(opts.size));
      return request<{ items: BazaarAgentOut[]; total: number; page: number; size: number }>(
        `/v1/bazaar/agents?${params}`,
        {},
        token
      );
    },
    get: (agentId: string, workspaceId: string, token: string) =>
      request<BazaarAgentOut>(
        `/v1/bazaar/agents/${agentId}?workspace_id=${workspaceId}`,
        {},
        token
      ),
    categories: (token: string) => request<CategoryOut[]>("/v1/bazaar/categories", {}, token),
    reviews: (agentId: string, token: string, page = 1) =>
      request<{ items: ReviewOut[]; total: number; page: number; size: number }>(
        `/v1/bazaar/agents/${agentId}/reviews?page=${page}`,
        {},
        token
      ),
    submitReview: (
      agentId: string,
      workspaceId: string,
      rating: number,
      body: string,
      token: string
    ) =>
      request<ReviewOut>(
        `/v1/bazaar/agents/${agentId}/reviews?workspace_id=${workspaceId}`,
        { method: "POST", body: JSON.stringify({ rating, body }) },
        token
      ),
  },
  hires: {
    list: (workspaceId: string, token: string, page = 1) =>
      request<{ items: BazaarAgentOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/hires?page=${page}`,
        {},
        token
      ),
    hire: (workspaceId: string, agentId: string, token: string) =>
      request<HireOut>(
        `/v1/workspaces/${workspaceId}/hires?agent_id=${agentId}`,
        { method: "POST" },
        token
      ),
    unhire: (workspaceId: string, agentId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/hires/${agentId}`, { method: "DELETE" }, token),
  },
  kb: {
    listKBs: (workspaceId: string, token: string, page = 1) =>
      request<{ items: KBOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/kbs?page=${page}`,
        {},
        token
      ),
    createKB: (
      workspaceId: string,
      body: { name: string; description?: string; scope?: string; agent_id?: string | null },
      token: string
    ) =>
      request<KBOut>(
        `/v1/workspaces/${workspaceId}/kbs`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        token
      ),
    getKB: (workspaceId: string, kbId: string, token: string) =>
      request<KBOut>(`/v1/workspaces/${workspaceId}/kbs/${kbId}`, {}, token),
    deleteKB: (workspaceId: string, kbId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/kbs/${kbId}`, { method: "DELETE" }, token),
    listDocuments: (workspaceId: string, kbId: string, token: string, page = 1) =>
      request<{ items: KBDocumentOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents?page=${page}`,
        {},
        token
      ),
    getDocument: (workspaceId: string, kbId: string, docId: string, token: string) =>
      request<KBDocumentOut>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents/${docId}`,
        {},
        token
      ),
    uploadDocument: (workspaceId: string, kbId: string, file: File, token: string) => {
      const form = new FormData();
      form.append("file", file);
      return request<KBUploadAcceptedOut>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents`,
        { method: "POST", body: form, headers: {} },
        token
      );
    },
    deleteDocument: (workspaceId: string, kbId: string, docId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents/${docId}`,
        { method: "DELETE" },
        token
      ),
    search: (workspaceId: string, kbId: string, query: string, topK: number, token: string) =>
      request<KBSearchOut>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/search`,
        { method: "POST", body: JSON.stringify({ query, top_k: topK }) },
        token
      ),
  },
};

export type KBOut = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  scope: string;
  agent_id: string | null;
  status: string;
  created_at: string;
};

export type KBDocumentOut = {
  id: string;
  kb_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  error_detail: string | null;
  page_count: number | null;
  token_count: number | null;
  created_at: string;
};

export type KBUploadAcceptedOut = {
  document_id: string;
  status: string;
  duplicate: boolean;
  message: string;
};

export type KBSearchResultItem = {
  chunk_id: string;
  document_id: string;
  filename: string;
  content: string;
  chunk_metadata: Record<string, unknown>;
  score: number;
  rrf_score: number;
};

export type KBSearchOut = {
  results: KBSearchResultItem[];
  total: number;
};
