# Phase 2 — Agent Lifecycle Core — Manual Test Checklist

**Prerequisites:** Phase 1 stack running. Migrations 0005–0007 applied (`make migrate`). A valid Builder JWT for workspace W1.

---

## How to run

```bash
# Start stack
make up

# Apply Phase 2 migrations
make migrate

# Run unit tests (no stack needed)
make test-py

# Validate all Phase 2 files are present + unit tests pass
make test-phase-2
```

---

## Scenarios

### 1. Builder uploads valid Dify YAML → agent appears in Drafts

**Steps:**
1. `POST /v1/workspaces/{wid}/agent-imports` (multipart, `file=valid.yaml`) with Builder JWT
2. `GET /v1/workspaces/{wid}/agents?status_filter=draft`

**Expected:** 201 on import; agent appears in list with `status=draft`, `version=1`

**Evidence:** DB row in `agents` + `agent_versions` + `agent_imports` (status=success)

- [ ] Pass / [ ] Fail

---

### 2. Builder uploads malformed YAML → 422 with errors, no partial state

**Steps:**
1. `POST /v1/workspaces/{wid}/agent-imports` with `file=broken.yaml` (e.g. `app: [unclosed`)

**Expected:** HTTP 422 with `{"errors": ["YAML parse error: ..."]}`. No agent row created.

**Evidence:** `agent_imports` row has `status=failed` and `error_msg` set. `agents` table unchanged.

- [ ] Pass / [ ] Fail

---

### 3. Builder uploads YAML > 1 MiB → 413

**Steps:**
1. `POST /v1/workspaces/{wid}/agent-imports` with 2 MiB file

**Expected:** HTTP 413 with `"YAML file exceeds 1 MiB limit"`

- [ ] Pass / [ ] Fail

---

### 4. Builder uploads YAML referencing non-existent tool → 422

**Steps:**
1. Upload YAML containing `tool_configurations: [{tool_id: some-tool}]`

**Expected:** HTTP 422 with `"Tool 'some-tool' is not registered for this workspace"`

- [ ] Pass / [ ] Fail

---

### 5. Builder updates draft → version 2 created, version 1 preserved

**Steps:**
1. `PATCH /v1/workspaces/{wid}/agents/{aid}` with `{"name": "Updated Name", "change_note": "rename"}`
2. `GET /v1/workspaces/{wid}/agents/{aid}/versions`

**Expected:** Agent `version=2`. Two version rows in response, newest first.

**Evidence:** `agent_versions` has 2 rows for this agent.

- [ ] Pass / [ ] Fail

---

### 6. Builder rolls back to version 1 → version 3 created from v1 snapshot

**Steps:**
1. `POST /v1/workspaces/{wid}/agents/{aid}/versions/1/rollback`
2. `GET /v1/workspaces/{wid}/agents/{aid}`

**Expected:** Agent `status=draft`, `version=3`. `name` reverts to v1 name. v1 and v2 unchanged in history.

- [ ] Pass / [ ] Fail

---

### 7. Builder publishes draft → status = published, audit row written

**Steps:**
1. `POST /v1/workspaces/{wid}/agents/{aid}/publish` (agent must be in draft)

**Expected:** 200, `status=published`.

**Evidence:** `audit_log` row with `action=agent.publish`, `outcome=success`.

- [ ] Pass / [ ] Fail

---

### 8. Cannot transition from published → draft (state machine enforcement)

**Steps:**
1. `PATCH /v1/workspaces/{wid}/agents/{aid}` on a published agent

**Expected:** HTTP 409 `"Only draft agents can be edited"`

- [ ] Pass / [ ] Fail

---

### 9. Cannot transition ARCHIVED → any state

**Steps:**
1. Archive an agent: `POST /v1/workspaces/{wid}/agents/{aid}/archive`
2. Attempt publish: `POST /v1/workspaces/{wid}/agents/{aid}/publish`

**Expected:** 409 on the publish attempt.

- [ ] Pass / [ ] Fail

---

### 10. Builder tests agent in sandbox → response returned

**Steps:**
1. Ensure agent has `dify_app_id` set (requires Dify running and agent registered)
2. `POST /v1/workspaces/{wid}/agents/{aid}/test` with `{"query": "hello"}`

**Expected:** 200 with `{"answer": "...", "usage": {...}}`

*Skip if Dify is not running — note in results.*

- [ ] Pass / [ ] Fail / [ ] Skipped

---

### 11. Sandbox quota: 100+ invocations today → 429

**Steps:**
1. Create 100 `audit_log` rows with `action=agent.test`, `outcome=success`, `actor_user_id=<user>`, today's date (can INSERT directly in SQL for testing)
2. `POST /v1/workspaces/{wid}/agents/{aid}/test`

**Expected:** HTTP 429 `"Sandbox quota reached: 100 invocations per day"`

- [ ] Pass / [ ] Fail

---

### 12. Builder clones published agent → new DRAFT in same workspace; owner = cloner

**Steps:**
1. Publish an agent
2. `POST /v1/workspaces/{wid}/agents/{aid}/clone`

**Expected:** 201 with new agent `status=draft`, `name="<original> (copy)"`, `owner_id=<cloner>`

**Evidence:** `audit_log` row with `action=agent.clone`.

- [ ] Pass / [ ] Fail

---

### 13. Viewer cannot create or edit agents (OPA enforcement)

**Steps:**
1. Use a Viewer JWT
2. `POST /v1/workspaces/{wid}/agent-imports` (multipart)

**Expected:** HTTP 403

- [ ] Pass / [ ] Fail

---

### 14. Agent in workspace A not visible to workspace B user (RLS)

**Steps:**
1. Create agent in workspace A
2. Authenticate as a user who is a member of workspace B only
3. `GET /v1/workspaces/{wid_b}/agents/{agent_a_id}`

**Expected:** HTTP 404

**Evidence (strongest):** Raw SQL query `SELECT * FROM agents WHERE id = '<agent_a_id>'` from a connection using workspace B's service key → 0 rows due to RLS.

- [ ] Pass / [ ] Fail

---

### 15. Archived agent hidden from default list; visible with `?status_filter=archived`

**Steps:**
1. Archive an agent
2. `GET /v1/workspaces/{wid}/agents` (no filter) → agent absent
3. `GET /v1/workspaces/{wid}/agents?status_filter=archived` → agent present

- [ ] Pass / [ ] Fail

---

### 16. Import from built-in template → agent created with template DSL

**Steps:**
1. `GET /v1/templates` → note template IDs
2. `POST /v1/workspaces/{wid}/agent-imports/template` with `{"template_id": "customer_support"}`

**Expected:** 201 with `status=draft`. Agent `name="Customer Support Agent"`.

- [ ] Pass / [ ] Fail

---

### 17. Ownership transfer by admin → owner_id changes, audit row written

**Steps:**
1. Use Admin JWT
2. `POST /v1/workspaces/{wid}/agents/{aid}/transfer` with `{"new_owner_id": "<user_b>"}`

**Expected:** 200 with `owner_id=<user_b>`.

**Evidence:** `audit_log` row with `action=agent.transfer`, metadata contains `from_owner` and `to_owner`.

- [ ] Pass / [ ] Fail

---

### 18. `GET /v1/templates` returns at least one template

**Steps:**
1. `GET /v1/templates` with a valid Bearer JWT

**Expected:** Array with at least one item: `[{"id": "customer_support", "name": "Customer Support Agent", "description": "..."}]`

- [ ] Pass / [ ] Fail

---

### 19. Frontend agent list page loads (UI)

**Steps:**
1. Navigate to `/workspaces/<wid>/agents`

**Expected:** Page renders with "Agents" heading, filter tabs (All / Draft / Published / Archived), and "New Agent" button.

- [ ] Pass / [ ] Fail

---

### 20. Frontend new agent page — YAML upload tab + Template tab visible

**Steps:**
1. Navigate to `/workspaces/<wid>/agents/new`

**Expected:** Two tabs. Upload tab shows file picker. Template tab shows template cards from API.

- [ ] Pass / [ ] Fail

---

## Unit test results

Run `make test-phase-2` and paste output:

```
(paste pytest output here)
```

All 35 tests: [ ] Pass / [ ] Some failing (list which)

---

## Sign-off

- Tester: ________________
- Date: ________________
- Overall: [ ] PASS — proceed to git tag `phase-2-complete`
           [ ] FAIL — failing scenarios listed above
