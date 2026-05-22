# Phase 5 — Tools, MCP & integrations — Manual test

> Run after `make up`. Mark each scenario pass/fail.
>
> Scope of this slice: MCP server registration (admin), tool discovery,
> per-agent whitelist (builder), and tool invocation with audit logging.
> Built-in MCP server sidecars (`filesystem-readonly`, `http-fetch`,
> `postgres-readonly`) and the n8n tool type are tracked separately as
> Phase 5 follow-on items — not required for this slice.

---

## 0. Pre-flight

- [ ] `make migrate` shows revision `0015` applied
- [ ] `docker logs wekala-opa --tail 5` shows the policy reloaded after Phase 5 changes
- [ ] `curl http://localhost:8001/healthz` returns 200
- [ ] You have a workspace and at least one logged-in admin user

---

## 1. SSRF protection on MCP registration (security review)

> Note: a 403 here means OPA rejected the call — that is a separate failure
> mode from the 400 SSRF reject. The expected response for these scenarios
> is **400 Bad Request** with a clear reason string.

- [ ] Register MCP server with `http://192.168.1.1/mcp` → **400 private address**
- [ ] Register MCP server with `http://127.0.0.1/mcp` → **400 loopback**
- [ ] Register MCP server with `http://169.254.169.254/` → **400 cloud-metadata**
- [ ] Register MCP server with `http://10.0.0.5/mcp` → **400 private address**
- [ ] Register MCP server with `file:///etc/passwd` → **400 scheme**
- [ ] Register MCP server with `gopher://example.com` → **400 scheme**
- [ ] Register MCP server with `http://does-not-exist.invalid/` → **400 resolve**
- [ ] Register MCP server with `https://example.com/mcp` → **201** (DNS resolves; example.com is public)
- [ ] List MCP servers → only public one appears

## 2. RBAC enforcement (OPA + role gating)

> Setup: invite a second user as `builder` to the same workspace.

- [ ] Builder calls `POST /v1/workspaces/{wid}/mcp-servers` → **403** (admin-only)
- [ ] Builder calls `DELETE /v1/workspaces/{wid}/mcp-servers/{sid}` → **403**
- [ ] Builder calls `POST .../mcp-servers/{sid}/discover` → **403**
- [ ] Builder calls `GET /v1/workspaces/{wid}/tools` → **200** (viewer+)
- [ ] Viewer-only user calls `POST .../agents/{aid}/tools` (grant) → **403** (builder+ only)
- [ ] Builder calls `POST .../agents/{aid}/tools/{tid}/invoke` → succeeds when tool granted, **403** when not granted

## 3. Tool discovery happy path — built-in MCP server

> The stack ships a built-in MCP server `wekala-mcp-time` as a Docker sidecar.
> Its hostname is in `MCP_BUILTIN_HOSTNAMES` so its Docker-private IP bypasses
> the SSRF guard. Registering it auto-flags the row `is_builtin=true`.

- [ ] `docker ps | grep wekala-mcp-time` shows the sidecar as healthy
- [ ] `curl http://localhost:3334/health` from the host returns `{"status":"ok"}` (port not exposed by default — skip if not mapped)
- [ ] Register MCP server with name `Time`, URL `http://wekala-mcp-time:3334/mcp` → **201**, response shows `is_builtin: true`
- [ ] Registering the same URL with a different name from another workspace also succeeds (built-ins are per-workspace registrations, not shared rows)
- [ ] Click "Discover" → toast `Discovery succeeded — 1 tool found`
- [ ] Workspace → Tools page lists `get_current_time` with the timezone-aware description
- [ ] Click "Discover" again → idempotent; same tool, no duplicates
- [ ] Stop the sidecar (`docker stop wekala-mcp-time`), click "Discover" → toast shows `MCP server returned HTTP …` or similar transport error; tool is not deactivated (discovery failed, not "tool missing")
- [ ] Start it again (`docker start wekala-mcp-time`), discovery succeeds again

## 4. Per-agent tool whitelist

> Setup: create an agent (workspace → Agents → New agent) and at least one
> tool exists from §3.

- [ ] Navigate to `/workspaces/{wid}/agents/{aid}/tools`
- [ ] All workspace tools appear with a `Grant` button
- [ ] Click `Grant` on tool A → button switches to `Revoke`; toast `Tool granted`
- [ ] Reload the page → A is still shown as granted
- [ ] Click `Revoke` → tool returns to "Grant"; toast `Tool revoked`
- [ ] Grant tool A again, then delete the MCP server → tool A disappears from agent grants (CASCADE)

## 5. Tool invocation (against the built-in `get_current_time`)

- [ ] Grant `get_current_time` to an agent
- [ ] Invoke with `{}` (no args) → **200**, `outcome=success`, `output_preview` is an ISO 8601 timestamp ending in `+00:00` (UTC)
- [ ] Invoke with `{"timezone":"Asia/Muscat"}` → **200**, timestamp ends in `+04:00`
- [ ] Invoke with `{"timezone":"Not/Real"}` → **502 Tool invocation failed: Unknown timezone…** (app-level error from the server's isError flag)
- [ ] Invoke with `{"foo":"bar"}` → **400 Tool input validation failed** (schema rejects extra fields)
- [ ] Invoke when the tool is NOT granted to the agent → **403 not granted**
- [ ] Invoke when the tool is `disabled` (set via DB) → **400 Tool is disabled**
- [ ] After each invocation: a row appears in `tool_invocations` with correct workspace_id, agent_id, tool_id, outcome, latency
- [ ] `GET /v1/workspaces/{wid}/tool-invocations?limit=10` returns the invocations in reverse-chrono order
- [ ] Latency stays under 200ms for the local sidecar (sanity check on the hot path budget)

## 6. Audit log

- [ ] After registering an MCP server: `audit_log` has a row with `action = mcp_server.register`, `actor_user_id = caller`, `actor_workspace_id = wid`, `resource_id = server_id`
- [ ] After discovery: row with `action = mcp_server.discover`, `metadata.tool_count = N`
- [ ] After granting a tool: row with `action = tool.grant`, `metadata.agent_id = aid`
- [ ] After invocation: row with `action = tool.invoke`, `outcome = success|failure`, `metadata.latency_ms`
- [ ] Failed discovery (unreachable MCP server): row with `action = mcp_server.discover`, `outcome = failure`, `metadata.error` set

## 7. Tenant isolation (RLS)

- [ ] User in workspace A cannot list MCP servers registered in workspace B (separate test account)
- [ ] User in workspace A cannot invoke a tool from workspace B (404, not 403 — the tool doesn't exist for them)
- [ ] Raw SQL check: `SET LOCAL "request.jwt.claim.sub" = '<user_a_uuid>'; SELECT * FROM mcp_servers;` only returns A's rows

## 8. Algorithmic / performance

- [ ] List MCP servers for a workspace returns in < 50ms with 100 servers in DB
- [ ] List workspace tools returns in < 50ms with 1000 tools
- [ ] Tool invocation overhead (excluding MCP server response time) < 50ms (latency_ms reflects total round-trip)
- [ ] No N+1 query patterns: `EXPLAIN ANALYZE` on `list_for_agent` uses the `(tool_id)` index, not a sequential scan

## 9. Frontend smoke (UI flow)

- [ ] Workspace sidebar shows a new "Tools" item (between Knowledge Base and Members)
- [ ] Tools page: empty state shows CTA `Register an MCP server`
- [ ] MCP servers page: form fields, error banners, table of registered servers all render
- [ ] Register MCP server form: typing a private URL like `http://192.168.0.1/` and submitting → red banner with SSRF reason
- [ ] Discover button shows the spinner / disabled state during the in-flight call
- [ ] Delete button on a non-builtin row prompts with `confirm()` and removes the row

## 10. Out of scope (deferred follow-on)

These items from the Phase 5 master plan are deliberately deferred and tracked
as follow-on work. The core framework (this slice) does not depend on them:

- Additional built-in MCP server sidecars: `filesystem-readonly`,
  `http-fetch`, `postgres-readonly` (the `wekala-mcp-time` sidecar in this
  slice is the template to follow)
- n8n workflow as a callable tool type
- HTTP/webhook tool builder UI
- Per-MCP-server outbound URL allow-list (`allowed_hosts` field exists in
  the model but is not yet enforced — to be added with `http-fetch` built-in)
- Sandbox quota integration (tool invocations counted against the per-user
  daily quota from Phase 2)
- Documentation for the team on building custom MCP servers (`packages/mcp-servers/time/main.py` is the working reference)

---

## Known gaps to fix in a follow-on slice

1. **Outbound URL allow-list not enforced** — the `mcp_servers.allowed_hosts`
   field exists in the schema but no built-in tool exercises it yet. To be
   added with the `http-fetch` built-in.
2. **No frontend "Invoke" / test playground** — admins can invoke via curl;
   a builder UI to test a granted tool against an agent would unblock manual
   tool authoring. Usability improvement, not a blocker.
3. **Sandbox quota not yet wired** — Phase 2's per-user daily quota does not
   currently count tool invocations. Track separately.
