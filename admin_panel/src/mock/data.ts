// Mock data so you can build the whole UI with NO backend, NO Docker. Shapes
// match src/types/api.ts exactly, so swapping to the real API is a 1-line change.

import type { Agent, AgentReport, AuditEvent, Kpis, Member } from "@/types/api";

export const MOCK_MEMBERS: Member[] = [
  { user_id: "u1", role: "admin", email: "amal@omantel.om", full_name: "Amal A.", invited_by: null },
  { user_id: "u2", role: "builder", email: "khalid@omantel.om", full_name: "Khalid S.", invited_by: "u1" },
  { user_id: "u3", role: "viewer", email: "noor@omantel.om", full_name: "Noor H.", invited_by: "u1" },
];

export const MOCK_AUDIT: AuditEvent[] = [
  { id: "a1", timestamp: new Date().toISOString(), actor_user_id: "u2", action: "agent.publish", resource_type: "agent", resource_id: "ag1", outcome: "success", metadata: {} },
  { id: "a2", timestamp: new Date(Date.now() - 3600e3).toISOString(), actor_user_id: "u1", action: "member.invite", resource_type: "member", resource_id: "u3", outcome: "success", metadata: { role: "viewer" } },
  { id: "a3", timestamp: new Date(Date.now() - 7200e3).toISOString(), actor_user_id: "u2", action: "agent.report", resource_type: "agent", resource_id: "ag2", outcome: "success", metadata: {} },
  { id: "a4", timestamp: new Date(Date.now() - 86400e3).toISOString(), actor_user_id: "u1", action: "auth.login", resource_type: "user", resource_id: "u1", outcome: "success", metadata: {} },
  { id: "a5", timestamp: new Date(Date.now() - 86400e3 - 7200e3).toISOString(), actor_user_id: "u2", action: "agent.create", resource_type: "agent", resource_id: "ag5", outcome: "success", metadata: { kind: "workflow" } },
  { id: "a6", timestamp: new Date(Date.now() - 2 * 86400e3).toISOString(), actor_user_id: "u3", action: "agent.invoke", resource_type: "agent", resource_id: "ag1", outcome: "success", metadata: {} },
  { id: "a7", timestamp: new Date(Date.now() - 2 * 86400e3 - 3600e3).toISOString(), actor_user_id: "u2", action: "agent.publish", resource_type: "agent", resource_id: "ag5", outcome: "failure", metadata: { reason: "vetting_failed" } },
  { id: "a8", timestamp: new Date(Date.now() - 2 * 86400e3 - 9000e3).toISOString(), actor_user_id: "u1", action: "member.role_change", resource_type: "member", resource_id: "u2", outcome: "success", metadata: { from: "viewer", to: "builder" } },
  { id: "a9", timestamp: new Date(Date.now() - 3 * 86400e3).toISOString(), actor_user_id: "u2", action: "kb.upload", resource_type: "document", resource_id: "doc-12", outcome: "success", metadata: { filename: "handbook.pdf" } },
  { id: "a10", timestamp: new Date(Date.now() - 3 * 86400e3 - 3600e3).toISOString(), actor_user_id: "u3", action: "auth.login", resource_type: "user", resource_id: "u3", outcome: "failure", metadata: { reason: "bad_password" } },
  { id: "a11", timestamp: new Date(Date.now() - 3 * 86400e3 - 7200e3).toISOString(), actor_user_id: "u2", action: "sila.tool_call", resource_type: "tool", resource_id: "web_fetch", outcome: "success", metadata: { tool: "web_fetch" } },
  { id: "a12", timestamp: new Date(Date.now() - 4 * 86400e3).toISOString(), actor_user_id: "u1", action: "agent.archive", resource_type: "agent", resource_id: "ag2", outcome: "success", metadata: {} },
  { id: "a13", timestamp: new Date(Date.now() - 4 * 86400e3 - 5400e3).toISOString(), actor_user_id: "u2", action: "agent.import", resource_type: "agent", resource_id: "ag5", outcome: "success", metadata: { source: "dify_yaml" } },
  { id: "a14", timestamp: new Date(Date.now() - 4 * 86400e3 - 9000e3).toISOString(), actor_user_id: null, action: "report.resolve", resource_type: "report", resource_id: "r1", outcome: "success", metadata: { by: "system" } },
  { id: "a15", timestamp: new Date(Date.now() - 5 * 86400e3).toISOString(), actor_user_id: "u1", action: "api_key.create", resource_type: "api_key", resource_id: "key-3", outcome: "success", metadata: {} },
  { id: "a16", timestamp: new Date(Date.now() - 5 * 86400e3 - 3600e3).toISOString(), actor_user_id: "u2", action: "agent.invoke", resource_type: "agent", resource_id: "ag1", outcome: "success", metadata: {} },
  { id: "a17", timestamp: new Date(Date.now() - 5 * 86400e3 - 7200e3).toISOString(), actor_user_id: "u3", action: "agent.report", resource_type: "agent", resource_id: "ag5", outcome: "success", metadata: {} },
  { id: "a18", timestamp: new Date(Date.now() - 6 * 86400e3).toISOString(), actor_user_id: "u1", action: "member.invite", resource_type: "member", resource_id: "u3", outcome: "success", metadata: { role: "viewer" } },
  { id: "a19", timestamp: new Date(Date.now() - 6 * 86400e3 - 5400e3).toISOString(), actor_user_id: "u2", action: "agent.publish", resource_type: "agent", resource_id: "ag1", outcome: "success", metadata: {} },
  { id: "a20", timestamp: new Date(Date.now() - 7 * 86400e3).toISOString(), actor_user_id: "u2", action: "tool.register", resource_type: "tool", resource_id: "http-fetch", outcome: "success", metadata: { server: "http-fetch" } },
  { id: "a21", timestamp: new Date(Date.now() - 8 * 86400e3).toISOString(), actor_user_id: "u1", action: "auth.login", resource_type: "user", resource_id: "u1", outcome: "success", metadata: {} },
  { id: "a22", timestamp: new Date(Date.now() - 9 * 86400e3).toISOString(), actor_user_id: "u3", action: "agent.invoke", resource_type: "agent", resource_id: "ag2", outcome: "failure", metadata: { error: "timeout" } },
  { id: "a23", timestamp: new Date(Date.now() - 10 * 86400e3).toISOString(), actor_user_id: "u2", action: "agent.create", resource_type: "agent", resource_id: "ag2", outcome: "success", metadata: { kind: "chat" } },
];

export const MOCK_REPORTS: AgentReport[] = [
  { id: "r1", agent_id: "ag2", workspace_id: "w1", reporter_id: "u3", reason: "Returns outdated policy info.", status: "open", created_at: new Date().toISOString(), resolved_at: null, resolved_by: null },
  { id: "r2", agent_id: "ag5", workspace_id: "w1", reporter_id: "u2", reason: "Tried to email data externally.", status: "reviewing", created_at: new Date(Date.now() - 86400e3).toISOString(), resolved_at: null, resolved_by: null },
];

export const MOCK_KPIS: Kpis = {
  invocations: 1284, hours_saved: 96, active_agents: 12, p95_latency_ms: 820,
  tool_calls: 433, vetting_runs_completed: 18, documents_uploaded: 41, range_days: 7,
};

export const MOCK_AGENTS: Agent[] = [
  { id: "ag1", name: "HR Policy Assistant", status: "published", classification: "internal", kind: "chat", vetting_status: "auto_approved", version: 3, created_at: new Date().toISOString() },
  { id: "ag2", name: "Invoice Reader", status: "in_review", classification: "restricted", kind: "chat", vetting_status: "ready_for_review", version: 1, created_at: new Date().toISOString() },
  { id: "ag5", name: "Weekly Report Bot", status: "draft", classification: "internal", kind: "workflow", vetting_status: "unvetted", version: 2, created_at: new Date().toISOString() },
];
