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
