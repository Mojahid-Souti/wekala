# Manual Test Checklist — Phase 14: Agent flow + runnable agents

Web at `http://localhost:3002`. Log in as a workspace **Builder** or **Admin**.

---

## Prerequisites for a LIVE agent run

The create/list/detail UI works without these, but actually **running** an agent
(the Test playground) needs the agent runtime configured:

- [ ] **Ollama models pulled** — `make pull-models` (qwen2.5:7b-instruct + bge-m3; ~10 GB, one-time).
- [ ] **Dify console token** — log into Dify at `http://localhost:3000`, create the
      admin account, mint a console API token, set `DIFY_CONSOLE_TOKEN=…` in `.env`,
      then `docker compose up -d --build wekala-api`.
- [ ] `make health` all green (incl. OPA policies ✓).

> Without these, the Test playground correctly fails **closed** with
> "The agent runtime isn't configured / available" (a 503) — see scenario 7.

---

## 1. New-Agent — 3 tabs

**Steps:** Agents → **New agent** (or sidebar Agents → Build/Templates/Import).

**Expected:** A page with **From template · Upload YAML · Build in Dify** tabs.
Template tab lists templates; Upload tab is the YAML drag/paste form; Build-in-Dify
links to the canvas.

- [ ] Pass  [ ] Fail

## 2. Create via template

**Steps:** New agent → From template → pick **Test template** → Create.

**Expected:** Redirects to the agents list; the agent appears as **Draft, Unvetted**.

- [ ] Pass  [ ] Fail

## 3. Create via upload YAML

**Steps:** New agent → Upload YAML → paste a valid Dify YAML → submit.

**Expected:** Imports as **Draft**; malformed YAML shows inline errors (no crash).

- [ ] Pass  [ ] Fail

## 4. Agents list — filters + sort

**Steps:** On the agents list, use **Class**, **Vetting**, **Sort** dropdowns and the status pills + search.

**Expected:** The grid narrows/reorders; **the URL reflects the filters** (`?class=…&vetting=…&sort=…&status=…`); browser **Back** restores the prior filter; "Clear filters" resets.

- [ ] Pass  [ ] Fail

## 5. Agent detail — tabs

**Steps:** Open an agent.

**Expected:** Header (name + status/vetting/classification badges + Publish/Archive/Clone) over tabs **Overview · Versions · Vetting · Tools · Test**. Overview shows metadata + tags; Versions lists versions with rollback; Vetting/Tools link to their full pages.

- [ ] Pass  [ ] Fail

## 6. Test playground — LIVE streaming ⭐ (needs prerequisites)

**Steps:** Agent → **Test** tab → type a question → **Run**.

**Expected:** The answer **streams in token-by-token** (a blinking cursor while
streaming); usage (tokens) shows on completion. Confirms Dify registration fired
(`dify_app_id` is now set on the agent in the DB) and Dify actually answered.

- [ ] Pass  [ ] Fail  [ ] Blocked (runtime not configured — see Prerequisites)

## 7. Test playground — fail-closed (no prerequisites needed)

**Steps:** With `DIFY_CONSOLE_TOKEN` unset (default), open Test → Run.

**Expected:** A clean amber message ("The agent runtime isn't configured…"), **not**
a broken stream or a 500. (Verified via API: `POST …/test-stream` → `503
{"detail":"Agent runtime is not configured"}`.)

- [ ] Pass  [ ] Fail

## 8. Quota

**Steps:** Lower `AGENT_SANDBOX_DAILY_QUOTA` in dev and exhaust it (needs a working runtime).

**Expected:** The playground shows a clean quota message (HTTP 429). Cancelled/failed runs do **not** burn quota.

- [ ] Pass  [ ] Fail  [ ] Blocked (runtime not configured)

## 9. Vet → publish

**Steps:** Agent → Vetting tab → Open vetting review → submit → approve (or auto).

**Expected:** Publish button enables once `vetting_status=approved`.

- [ ] Pass  [ ] Fail

## 10. Edit re-registers (needs working runtime)

**Steps:** Rollback to a prior version, then run the Test tab again.

**Expected:** The next run re-registers (a fresh `dify_app_id`) and reflects the rolled-back definition.

- [ ] Pass  [ ] Fail  [ ] Blocked (runtime not configured)

## 11. No regressions

**Steps:** Templates, Import, Vetting, Tools pages; dashboard/home "New agent" quick action → lands on the 3-tab page.

**Expected:** All load and navigate normally.

- [ ] Pass  [ ] Fail

---

## Automated checks (already green)

- `cd apps/api && uv run pytest` → 167 passed (incl. `tests/test_agent_stream.py`: SSE parse, `_ensure_registered` fail-closed, stream quota).
- `cd apps/web && pnpm exec tsc --noEmit` → 0 errors; `pnpm exec biome check` → clean.
- API verified live: login → import template (Draft/Unvetted) → `test-stream` returns a proper `503` JSON (generator-priming + fail-closed confirmed).

---

## Summary

| # | Scenario | Result |
|---|---|---|
| 1 | New-Agent 3 tabs | |
| 2 | Create via template | |
| 3 | Create via upload | |
| 4 | List filters + sort (URL) | |
| 5 | Detail tabs | |
| 6 | Test playground streams live | |
| 7 | Test playground fail-closed | |
| 8 | Quota 429 | |
| 9 | Vet → publish | |
| 10 | Edit re-registers | |
| 11 | No regressions | |

**Tester:** _______________  **Date:** _______________
