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
  { id: "r1",  agent_id: "ag2", workspace_id: "w1", reporter_id: "u3", reason: "Returns outdated policy info.",                          status: "open",       created_at: new Date(Date.now() -      0).toISOString(), resolved_at: null,                                          resolved_by: null },
  { id: "r2",  agent_id: "ag5", workspace_id: "w1", reporter_id: "u2", reason: "Tried to email data externally.",                        status: "reviewing",  created_at: new Date(Date.now() -  86400e3).toISOString(), resolved_at: null,                                          resolved_by: null },
  { id: "r3",  agent_id: "ag1", workspace_id: "w1", reporter_id: "u2", reason: "Provided confidential HR data without verification.",    status: "resolved",   created_at: new Date(Date.now() - 172800e3).toISOString(), resolved_at: new Date(Date.now() -  43200e3).toISOString(), resolved_by: "u1" },
  { id: "r4",  agent_id: "ag2", workspace_id: "w1", reporter_id: "u1", reason: "Response time exceeds 30 seconds consistently.",         status: "dismissed",  created_at: new Date(Date.now() - 259200e3).toISOString(), resolved_at: new Date(Date.now() - 172800e3).toISOString(), resolved_by: "u1" },
  { id: "r5",  agent_id: "ag1", workspace_id: "w1", reporter_id: "u3", reason: "Outputs inconsistent with policy version 3.2.",          status: "open",       created_at: new Date(Date.now() - 345600e3).toISOString(), resolved_at: null,                                          resolved_by: null },
  { id: "r6",  agent_id: "ag5", workspace_id: "w1", reporter_id: "u1", reason: "Sent weekly digest to an external recipient.",           status: "reviewing",  created_at: new Date(Date.now() - 432000e3).toISOString(), resolved_at: null,                                          resolved_by: null },
  { id: "r7",  agent_id: "ag2", workspace_id: "w1", reporter_id: "u3", reason: "Listed incorrect cost-center codes on three invoices.",  status: "resolved",   created_at: new Date(Date.now() - 518400e3).toISOString(), resolved_at: new Date(Date.now() - 432000e3).toISOString(), resolved_by: "u1" },
  { id: "r8",  agent_id: "ag5", workspace_id: "w1", reporter_id: "u2", reason: "Report generated with wrong date range.",               status: "dismissed",  created_at: new Date(Date.now() - 604800e3).toISOString(), resolved_at: new Date(Date.now() - 518400e3).toISOString(), resolved_by: "u1" },
  { id: "r9",  agent_id: "ag1", workspace_id: "w1", reporter_id: "u2", reason: "Hallucinated section numbers in policy responses.",      status: "open",       created_at: new Date(Date.now() - 691200e3).toISOString(), resolved_at: null,                                          resolved_by: null },
  { id: "r10", agent_id: "ag2", workspace_id: "w1", reporter_id: "u1", reason: "Accessed a document outside the permitted knowledge base.", status: "reviewing", created_at: new Date(Date.now() - 777600e3).toISOString(), resolved_at: null,                                         resolved_by: null },
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
