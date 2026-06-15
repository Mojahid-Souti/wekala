// Reference data shapes — these mirror the REAL Sila backend responses, so when
// this panel is integrated into the main app the wiring lines up. Don't rename
// fields; they map 1:1 to the API. (Source: apps/web/lib/api.ts.)

export type Member = {
  user_id: string;
  role: "admin" | "builder" | "reviewer" | "hirer" | "viewer" | string;
  invited_by: string | null;
  email?: string | null;
  full_name?: string | null;
};

export type AuditEvent = {
  id: string;
  timestamp: string; // ISO
  actor_user_id: string | null;
  action: string; // e.g. "agent.publish", "sila.tool_call"
  resource_type: string | null;
  resource_id: string | null;
  outcome: "success" | "failure" | string;
  metadata: Record<string, unknown>;
};

export type AuditLogPage = {
  items: AuditEvent[];
  total: number;
  page: number;
  size: number;
};

// agent_reports (Phase 15). One report row per user submission.
export type AgentReport = {
  id: string;
  agent_id: string;
  workspace_id: string;
  reporter_id: string;
  reason: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type Kpis = {
  invocations: number;
  hours_saved: number;
  active_agents: number;
  p95_latency_ms: number;
  tool_calls: number;
  vetting_runs_completed: number;
  documents_uploaded: number;
  range_days: number;
};

export type AgentLeaderboardRow = {
  agent_id: string;
  name: string;
  invocations: number;
  success_rate: number;
  p95_latency_ms: number;
  hours_saved: number;
};

export type Agent = {
  id: string;
  name: string;
  status: "draft" | "in_review" | "published" | "archived" | string;
  classification: "public" | "internal" | "restricted" | "confidential" | string;
  kind: "chat" | "workflow" | string;
  vetting_status: string;
  version: number;
  created_at: string;
};
