import { API_URL, ROUTES } from "./constants";

function handleExpiredSession(): void {
  // Only run in browser; avoid loop if already on an auth page.
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("refresh_token");
  window.location.href = `${ROUTES.login}?expired=1`;
}

function formatErrorDetail(detail: unknown, status: number): string {
  // FastAPI returns either a string (HTTPException) or an array of
  // Pydantic-validation objects (RequestValidationError). Format the array
  // into a human-readable single line so toasts/banners don't show
  // "[object Object]".
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object" && "msg" in d) {
          const loc = Array.isArray((d as { loc?: unknown[] }).loc)
            ? (d as { loc: unknown[] }).loc.join(".")
            : "";
          return loc ? `${loc}: ${(d as { msg: string }).msg}` : (d as { msg: string }).msg;
        }
        return JSON.stringify(d);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return `HTTP ${status}`;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  // FormData (file uploads) needs the browser to set the multipart boundary;
  // forcing JSON Content-Type would corrupt the upload and cause a 422.
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    // Token was present but rejected → expired or revoked. Clear + redirect to login.
    handleExpiredSession();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatErrorDetail(body.detail, res.status));
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
  vetting_status: string;
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
    create: (name: string, description: string, token: string) =>
      request<{ id: string; name: string; slug: string; description: string; owner_id: string }>(
        "/v1/workspaces",
        { method: "POST", body: JSON.stringify({ name, description }) },
        token
      ),
    list: (token: string) =>
      request<{ id: string; name: string; slug: string; description: string }[]>(
        "/v1/workspaces",
        {},
        token
      ),
    get: (workspaceId: string, token: string) =>
      request<{ id: string; name: string; slug: string; description: string; owner_id: string }>(
        `/v1/workspaces/${workspaceId}`,
        {},
        token
      ),
    update: (workspaceId: string, name: string, description: string, token: string) =>
      request<{ id: string; name: string; slug: string; description: string; owner_id: string }>(
        `/v1/workspaces/${workspaceId}`,
        { method: "PUT", body: JSON.stringify({ name, description }) },
        token
      ),
    delete: (workspaceId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}`, { method: "DELETE" }, token),
    members: {
      list: (workspaceId: string, token: string) =>
        request<{ user_id: string; role: string; invited_by: string | null }[]>(
          `/v1/workspaces/${workspaceId}/members`,
          {},
          token
        ),
      invite: (workspaceId: string, userId: string, role: string, token: string) =>
        request<{ user_id: string; role: string; invited_by: string | null }>(
          `/v1/workspaces/${workspaceId}/members`,
          { method: "POST", body: JSON.stringify({ user_id: userId, role }) },
          token
        ),
      remove: (workspaceId: string, userId: string, token: string) =>
        request<void>(
          `/v1/workspaces/${workspaceId}/members/${userId}`,
          { method: "DELETE" },
          token
        ),
    },
  },
  users: {
    lookup: (email: string, token: string) =>
      request<{ id: string; email: string }>(
        `/v1/users/lookup?email=${encodeURIComponent(email)}`,
        {},
        token
      ),
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
  mcpServers: {
    list: (workspaceId: string, token: string) =>
      request<MCPServerOut[]>(`/v1/workspaces/${workspaceId}/mcp-servers`, {}, token),
    register: (
      workspaceId: string,
      body: { name: string; description?: string; url: string },
      token: string
    ) =>
      request<MCPServerOut>(
        `/v1/workspaces/${workspaceId}/mcp-servers`,
        { method: "POST", body: JSON.stringify(body) },
        token
      ),
    delete: (workspaceId: string, serverId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/mcp-servers/${serverId}`,
        { method: "DELETE" },
        token
      ),
    discover: (workspaceId: string, serverId: string, token: string) =>
      request<ToolOut[]>(
        `/v1/workspaces/${workspaceId}/mcp-servers/${serverId}/discover`,
        { method: "POST" },
        token
      ),
  },
  tools: {
    listWorkspaceTools: (workspaceId: string, token: string) =>
      request<ToolOut[]>(`/v1/workspaces/${workspaceId}/tools`, {}, token),
    listAgentTools: (workspaceId: string, agentId: string, token: string) =>
      request<ToolOut[]>(`/v1/workspaces/${workspaceId}/agents/${agentId}/tools`, {}, token),
    grant: (workspaceId: string, agentId: string, toolId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/tools`,
        { method: "POST", body: JSON.stringify({ tool_id: toolId }) },
        token
      ),
    revoke: (workspaceId: string, agentId: string, toolId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/tools/${toolId}`,
        { method: "DELETE" },
        token
      ),
    invoke: (
      workspaceId: string,
      agentId: string,
      toolId: string,
      args: Record<string, unknown>,
      token: string
    ) =>
      request<ToolInvocationOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/tools/${toolId}/invoke`,
        { method: "POST", body: JSON.stringify({ arguments: args }) },
        token
      ),
    recentInvocations: (workspaceId: string, token: string, limit = 50) =>
      request<ToolInvocationOut[]>(
        `/v1/workspaces/${workspaceId}/tool-invocations?limit=${limit}`,
        {},
        token
      ),
  },
  vetting: {
    submit: (workspaceId: string, agentId: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/submit-for-review`,
        { method: "POST" },
        token
      ),
    listRuns: (workspaceId: string, agentId: string, token: string) =>
      request<VettingRunOut[]>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs`,
        {},
        token
      ),
    getRun: (workspaceId: string, agentId: string, runId: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}`,
        {},
        token
      ),
    listFindings: (workspaceId: string, agentId: string, runId: string, token: string) =>
      request<VettingFindingOut[]>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}/findings`,
        {},
        token
      ),
    approve: (workspaceId: string, agentId: string, runId: string, note: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}/approve`,
        { method: "POST", body: JSON.stringify({ note }) },
        token
      ),
    reject: (workspaceId: string, agentId: string, runId: string, note: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}/reject`,
        { method: "POST", body: JSON.stringify({ note }) },
        token
      ),
  },
  apiKeys: {
    list: (workspaceId: string, token: string) =>
      request<ApiKeyOut[]>(`/v1/workspaces/${workspaceId}/api-keys`, {}, token),
    create: (workspaceId: string, name: string, token: string) =>
      request<ApiKeyCreatedOut>(
        `/v1/workspaces/${workspaceId}/api-keys`,
        { method: "POST", body: JSON.stringify({ name }) },
        token
      ),
    revoke: (workspaceId: string, keyId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/api-keys/${keyId}`, { method: "DELETE" }, token),
  },
  webhooks: {
    list: (workspaceId: string, token: string) =>
      request<WebhookOut[]>(`/v1/workspaces/${workspaceId}/webhooks`, {}, token),
    create: (
      workspaceId: string,
      body: { name: string; url: string; events: string[] },
      token: string
    ) =>
      request<WebhookCreatedOut>(
        `/v1/workspaces/${workspaceId}/webhooks`,
        { method: "POST", body: JSON.stringify(body) },
        token
      ),
    delete: (workspaceId: string, subscriptionId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/webhooks/${subscriptionId}`,
        { method: "DELETE" },
        token
      ),
    events: (workspaceId: string, token: string) =>
      request<string[]>(`/v1/workspaces/${workspaceId}/webhooks/events`, {}, token),
  },
};

export type ApiKeyOut = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
};

export type ApiKeyCreatedOut = ApiKeyOut & { key: string };

export type WebhookOut = {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  events: string[];
  secret_prefix: string;
  status: string;
  created_at: string;
};

export type WebhookCreatedOut = WebhookOut & { secret: string };

export type VettingRunOut = {
  id: string;
  agent_id: string;
  workspace_id: string;
  classification: string;
  status: string;
  outcome: string | null;
  triggered_by: string;
  approved_by: string | null;
  approval_decision: string | null;
  approval_note: string | null;
  finding_summary: {
    total?: number;
    by_severity?: Record<string, number>;
    by_type?: Record<string, number>;
  };
  started_at: string;
  completed_at: string | null;
};

export type VettingFindingOut = {
  id: string;
  finding_type: string;
  severity: string;
  location: string;
  matched_preview: string;
  matched_full: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type MCPServerOut = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  url: string;
  transport: string;
  is_builtin: boolean;
  status: string;
};

export type ToolOut = {
  id: string;
  mcp_server_id: string;
  workspace_id: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  status: string;
};

export type ToolInvocationOut = {
  id: string;
  tool_id: string | null;
  agent_id: string | null;
  outcome: string;
  latency_ms: number;
  output_preview: string;
  error: string | null;
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
