// Mock data so you can build the whole UI with NO backend, NO Docker. Shapes
// match src/types/api.ts exactly, so swapping to the real API is a 1-line change.

import type { Agent, AgentReport, AuditEvent, Kpis, Member } from "@/types/api";

export const MOCK_MEMBERS: Member[] = [
  { user_id: "u1",  role: "admin",    email: "amal@omantel.om",   full_name: "Amal Al-Rashidi",  invited_by: null },
  { user_id: "u2",  role: "builder",  email: "khalid@omantel.om", full_name: "Khalid Al-Saadi",  invited_by: "u1" },
  { user_id: "u3",  role: "viewer",   email: "noor@omantel.om",   full_name: "Noor Al-Habsi",    invited_by: "u1" },
  { user_id: "u4",  role: "builder",  email: "hassan@omantel.om", full_name: "Hassan Al-Balushi", invited_by: "u1" },
  { user_id: "u5",  role: "reviewer", email: "fatima@omantel.om", full_name: "Fatima Al-Rawahi", invited_by: "u2" },
  { user_id: "u6",  role: "hirer",    email: "yousef@omantel.om", full_name: "Yousef Al-Farsi",  invited_by: "u1" },
  { user_id: "u7",  role: "reviewer", email: "sara@omantel.om",   full_name: "Sara Al-Maamari",  invited_by: "u2" },
  { user_id: "u8",  role: "hirer",    email: "tariq@omantel.om",  full_name: "Tariq Al-Kindi",   invited_by: "u1" },
  { user_id: "u9",  role: "builder",  email: "layla@omantel.om",  full_name: "Layla Al-Yahyai",  invited_by: "u2" },
  { user_id: "u10", role: "viewer",   email: "ahmed@omantel.om",  full_name: "Ahmed Al-Hinai",   invited_by: "u1" },
];

export const MOCK_AUDIT: AuditEvent[] = [
  { id: "a1", timestamp: new Date().toISOString(),                          actor_user_id: "u2", action: "agent.publish",   resource_type: "agent",  resource_id: "ag1", outcome: "success", metadata: {} },
  { id: "a2", timestamp: new Date(Date.now() - 3600e3).toISOString(),       actor_user_id: "u1", action: "member.invite",   resource_type: "member", resource_id: "u5",  outcome: "success", metadata: { role: "reviewer" } },
  { id: "a3", timestamp: new Date(Date.now() - 7200e3).toISOString(),       actor_user_id: "u2", action: "agent.report",   resource_type: "agent",  resource_id: "ag2", outcome: "success", metadata: {} },
  { id: "a4", timestamp: new Date(Date.now() - 10800e3).toISOString(),      actor_user_id: "u4", action: "agent.create",   resource_type: "agent",  resource_id: "ag5", outcome: "success", metadata: {} },
  { id: "a5", timestamp: new Date(Date.now() - 86400e3).toISOString(),      actor_user_id: "u1", action: "workspace.update", resource_type: "workspace", resource_id: "w1", outcome: "success", metadata: {} },
];

export const MOCK_REPORTS: AgentReport[] = [
  { id: "r1",  agent_id: "ag2", workspace_id: "w1", reporter_id: "u3",  reason: "Returns outdated policy information.",           status: "open",       created_at: new Date().toISOString(),                                      resolved_at: null,                                         resolved_by: null },
  { id: "r2",  agent_id: "ag5", workspace_id: "w1", reporter_id: "u2",  reason: "Attempted to access restricted data.",           status: "reviewing",  created_at: new Date(Date.now() -  1 * 86400e3).toISOString(),             resolved_at: null,                                         resolved_by: null },
  { id: "r3",  agent_id: "ag1", workspace_id: "w1", reporter_id: "u6",  reason: "Incorrect totals in invoice summary.",           status: "open",       created_at: new Date(Date.now() -  2 * 86400e3).toISOString(),             resolved_at: null,                                         resolved_by: null },
  { id: "r4",  agent_id: "ag2", workspace_id: "w1", reporter_id: "u4",  reason: "Leaked member names in response.",               status: "open",       created_at: new Date(Date.now() -  3 * 86400e3).toISOString(),             resolved_at: null,                                         resolved_by: null },
  { id: "r5",  agent_id: "ag1", workspace_id: "w1", reporter_id: "u10", reason: "Refused valid HR leave queries.",                status: "reviewing",  created_at: new Date(Date.now() -  4 * 86400e3).toISOString(),             resolved_at: null,                                         resolved_by: null },
  { id: "r6",  agent_id: "ag5", workspace_id: "w1", reporter_id: "u7",  reason: "Slow on documents larger than 50 pages.",        status: "reviewing",  created_at: new Date(Date.now() -  5 * 86400e3).toISOString(),             resolved_at: null,                                         resolved_by: null },
  { id: "r7",  agent_id: "ag2", workspace_id: "w1", reporter_id: "u8",  reason: "Missing citation for regulation reference.",     status: "resolved",   created_at: new Date(Date.now() -  7 * 86400e3).toISOString(),             resolved_at: new Date(Date.now() - 1 * 86400e3).toISOString(), resolved_by: "u1" },
  { id: "r8",  agent_id: "ag1", workspace_id: "w1", reporter_id: "u5",  reason: "Repetitive answers on maternity-leave policy.",  status: "resolved",   created_at: new Date(Date.now() -  8 * 86400e3).toISOString(),             resolved_at: new Date(Date.now() - 2 * 86400e3).toISOString(), resolved_by: "u1" },
  { id: "r9",  agent_id: "ag5", workspace_id: "w1", reporter_id: "u9",  reason: "Sent unrelated workflow output to user.",        status: "dismissed",  created_at: new Date(Date.now() - 10 * 86400e3).toISOString(),             resolved_at: new Date(Date.now() - 3 * 86400e3).toISOString(), resolved_by: "u2" },
  { id: "r10", agent_id: "ag2", workspace_id: "w1", reporter_id: "u3",  reason: "Duplicate of r1; filed in error.",               status: "dismissed",  created_at: new Date(Date.now() - 12 * 86400e3).toISOString(),             resolved_at: new Date(Date.now() - 4 * 86400e3).toISOString(), resolved_by: "u1" },
];

export const MOCK_KPIS: Kpis = {
  invocations: 1284, hours_saved: 96, active_agents: 12, p95_latency_ms: 820,
  tool_calls: 433, vetting_runs_completed: 18, documents_uploaded: 41, range_days: 7,
};

export const MOCK_AGENTS: Agent[] = [
  { id: "ag1", name: "HR Policy Assistant", status: "published", classification: "internal",   kind: "chat",     vetting_status: "auto_approved",    version: 3, created_at: new Date().toISOString() },
  { id: "ag2", name: "Invoice Reader",      status: "in_review", classification: "restricted", kind: "chat",     vetting_status: "ready_for_review",  version: 1, created_at: new Date().toISOString() },
  { id: "ag5", name: "Weekly Report Bot",   status: "draft",     classification: "internal",   kind: "workflow", vetting_status: "unvetted",          version: 2, created_at: new Date().toISOString() },
];
