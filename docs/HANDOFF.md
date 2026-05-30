# Wekala — Session handoff (2026-05-30)

Single source of truth for the next Claude Code session. Read this first, then `CLAUDE.md`, then `PHASE_LOG.md`.

## Repo state right now

- **Last pushed commit**: `b1692c3` — "fix(ci): green mypy + pip-audit; pre-existing strict-mode drift"
- **All work below this line is unpushed.** A lot of it isn't even committed — `git status` will show many `M` and `??` entries. **Verify before tagging anything.**

## What shipped in this session (uncommitted)

### 1. LLM-driven security gatekeeper (Phase 6 extension)
The Phase 6 gatekeeper used to be regex-only (Presidio PII + rule-based prompt-injection). It now **also** runs an LLM review in parallel.

- **New `LLMGateway` interface** at [apps/api/wekala/adapters/llm/base.py](../apps/api/wekala/adapters/llm/base.py) (Rule 5 swap point). Single method: `complete_json(system_prompt, user_prompt, timeout_s) -> dict`. Raises `LLMGatewayError` on timeout/HTTP failure/malformed JSON.
- **`OllamaLLMAdapter`** at [apps/api/wekala/adapters/llm/ollama.py](../apps/api/wekala/adapters/llm/ollama.py) — `POST /api/chat` with `format: "json"`, low temperature, fence-stripping JSON parse.
- **`LLMScanner`** at [apps/api/wekala/adapters/scanner/llm.py](../apps/api/wekala/adapters/scanner/llm.py) — implements the existing `AgentScanner` Protocol. Sees the full Dify DSL (added `dify_dsl: dict | None` to `ScanInput`). Prompt encodes Omani PII patterns + injection taxonomy + "prefer empty list" anti-hallucination clause.
- **Vetting orchestration** at [apps/api/wekala/services/vetting_service.py](../apps/api/wekala/services/vetting_service.py) — `_default_scanners()` returns `[LLMScanner, PIIScanner, RuleBasedInjectionScanner]` (parallel via `asyncio.gather`). `_dedupe_findings()` collapses by `(finding_type, location, normalized first-30-chars)` — needed because LLM + regex frequently report the same logical issue with slightly different `matched_full`.
- **Settings**: `llm_scanner_model` (default `qwen2.5:7b-instruct`) + `llm_scanner_timeout_s` (default 30s) in [apps/api/wekala/core/config.py](../apps/api/wekala/core/config.py).
- **Tests**: [apps/api/tests/test_llm_scanner.py](../apps/api/tests/test_llm_scanner.py) — 7 tests, all green. Fully mocked gateway, no real Ollama call in CI.
- **Fail-closed**: LLM gateway error → scanner returns `[]`, regex baseline still runs, scan completes normally.
- **End-to-end smoke**: validated on [docs/phases/poisoned-test-agent.yaml](phases/poisoned-test-agent.yaml) — 9 findings, 5 critical, 4 high. Scanner working.

### 2. Vetting page redesign (multiple iterations)
- Cards on left, editor on right (UML-diagram style).
- **Grouped by line**: same-line findings collapse into one card with an internal `‹ 1/3 ›` pager. Cards sorted by line ascending.
- Editor flash on jump, `×N` count badge inline on multi-finding lines, tooltip lists all findings on a line.
- **Decision inbox button** in header — neutral B&W, single dot badge (was "5", was misleading). Auto-closes on mutation settle (prevents the 10-toasts-from-10-clicks bug). Per-runId "seen" tracking so badge clears once viewed.
- **History sheet** — new icon next to inbox. Per-agent localStorage `wekala.vetting.history.lastSeen.<agentId>` tracks unread count.
- Click handling: pass card **index** through, not line — fixes the "middle card not clickable" bug when multiple findings share a line. 600ms jump-lock prevents `handleEditorScroll` fighting the user click.
- Leader-line arrows were built then **fully ripped out** — too fiddly, no value-add. Don't reinstate.

### 3. Workspace home redesign
- [apps/web/app/(app)/workspaces/[workspaceId]/page.tsx](../apps/web/app/(app)/workspaces/[workspaceId]/page.tsx) — neutral palette throughout (no purple), avatar rows for members with hex-derived initials, stat tiles with icon chips, three action tiles (New agent = primary black tile), 2-column members+invite layout.
- **Role dropdown** is now a shadcn `DropdownMenu`-based component with role descriptions ("Builder — Create and edit agents"). Native `<select>` killed.
- Members still display UUIDs — the `/v1/workspaces/{wid}/members` endpoint needs to surface email/name (small backend change, see "Outstanding" below).

### 4. Other UI work
- Legacy `/workspaces/[id]/agents/new` → server redirect to `/agents/templates`. `ROUTES.newAgent` now resolves to templates directly.
- Workspace member invite now uses the styled role dropdown.

## Outstanding tasks

### Plumbing / housekeeping
1. **Commit + push everything in working tree.** Many `M` + untracked files since `b1692c3`. Suggest splitting into logical commits:
   - `feat(phase-6-llm-gatekeeper): ...` — LLM scanner + tests
   - `feat(vetting-ui): ...` — vetting page redesign (cards, editor, decision inbox, history sheet)
   - `feat(workspace-home): ...` — workspace home redesign + role dropdown
   - `chore(routes): redirect legacy /agents/new`
   - One commit for the deleted `apps/api/wekala/templates/customer_support.yaml` and the new `apps/api/wekala/templates/test.yaml`
2. **Tag `phase-B-multitenancy-complete`** + add `PHASE_LOG.md` entry. Phase B (n8n per-user workspaces) shipped at `a3bb487` but was never tagged. See [memory/project-phase-b-status.md].
3. **Manual test docs**: `docs/phases/MANUAL_TEST_PHASE_6_LLM.md` not yet written. Required by Rule 3 before tagging the LLM gatekeeper work.

### Small backend gaps
4. **Surface `email` + `full_name` on `/v1/workspaces/{wid}/members`** so the workspace home avatar can show real initials instead of UUID-hex. One-line change in the repository + Pydantic schema. After this, `apps/web/app/(app)/workspaces/[workspaceId]/page.tsx` should swap `initials(m.user_id)` → `initials(m.email)` and `shortenId(m.user_id)` → `m.email`.
5. **"Register as agent" button → persist n8n workflow ID** into the Wekala `agents` table. Live TODO from before this session. Belongs in Phase 15 (builder bridges).
6. **`AgentRuntime.invoke()` TODO** — currently a phantom method with `# type: ignore`. Real implementation needed for the test playground (Phase 14).
7. **MCP auth Tier 2 — OAuth 2.1 (planned).** Tier 1 (static token / API key, Fernet-encrypted) shipped this session — see CLAUDE.md §6 "MCP authentication". Tier 2 (OAuth: dynamic client registration + PKCE + browser consent + token refresh + callback endpoint) is a future mini-phase for SaaS servers (Sentry/Linear/Notion/GitHub/Atlassian). Not started.

### Phase 11–15 roadmap (per CLAUDE.md §6)
Execution order is **11 → 12 → 13 → 14 → 15 → 9 → 10 → 16**. Numbering append-only.

- **Phase 11 — Design system foundation** ✅ mostly done implicitly (shadcn installed, primitives in use across vetting / workspace home / dashboard). Outstanding: onboarding wizard after signup, design-token doc.
- **Phase 12 — Auth flow redesign** ❌ not started. Sign-up, sign-in, verify, reset-password all still on old Tailwind. Plan exists in CLAUDE.md.
- **Phase 13 — App shell + dashboard** 🟡 partial. Dashboard greeting + sidebar shipped in `1ba0789` (phase-platform-shell). Outstanding: collapsible double-sidebar polish, workspace home (✅ just done), settings tabs.
- **Phase 14 — Agent flow redesign** 🟡 partial. Templates page ✅, Import page ✅, Vetting page ✅. Outstanding: agents list polish, agent detail tabs (Overview / Versions / Vetting / Tools / Test), New-Agent 4-tab page (currently just Templates + Upload), test playground with SSE streaming, chat-to-build wizard.
- **Phase 15 — Builder bridges** ❌ not started. "Build in Dify" deep-link, n8n workflows sidebar, Langfuse trace deep-links, agent reports table + UI, tool playground.
- **Phase 9 — Voice**, **Phase 10 — Localization** — deferred to after 11–15.
- **Phase 16 — SILA: Conversational Platform Concierge** ⭐ (capstone, the "JARVIS") ❌ not started. Voice/text concierge that lets non-experts build agents + n8n workflows by talking; asks clarifying questions, opens mid-session modals (e.g. uploads), drives the platform UI — all within the user's role. Decisions locked: **text-first then voice · builds both Dify agents + n8n workflows · builder-scope only (no delete/publish/admin) · capstone after Phase 9 + 15 + the KB worker-container fix.** Full spec in CLAUDE.md §6 Phase 16. Hard prereq: move KB document processing to a dedicated worker container (the in-process pipeline twice took the API down). Stages: 16A LLM gateway streaming+tool-calling · 16B concierge brain + tool registry + WebSocket · 16C agent/workflow generators · 16D orb widget + mid-session modals · 16E voice (Phase 9 stack).

## Files to read before changing anything

| File | Why |
|---|---|
| `CLAUDE.md` | The 10 working rules. **Non-negotiable.** Re-read every session. |
| `PHASE_LOG.md` | What's actually shipped + tagged so far. Check this before claiming a phase is done. |
| `memory/MEMORY.md` | Project memory index (user profile, project state, Phase B status, n8n multi-tenancy gap). |
| `docs/HANDOFF.md` | This file. |
| `docs/phases/poisoned-test-agent.yaml` | Test fixture for the gatekeeper. Used by the manual smoke test. |

## Verify before you trust this doc

```bash
git status                                  # confirm uncommitted scope
git log --oneline -10                       # confirm last pushed commit
cd apps/api && uv run pytest tests/test_llm_scanner.py -v  # 7 tests should pass
cd apps/web && pnpm exec tsc --noEmit       # should report exactly 1 pre-existing error (import-yaml-form drag handler)
```

## Known quirks / don't-relitigate-this

- **Leader-line arrows** were tried multiple times in the vetting UI. **Don't.** They were ripped out because the geometry kept breaking at edge cases and added no review value. Click-to-jump + line flash + `×N` badges cover the same affordance.
- **Inbox badge as count of criticals** was wrong. One inbox = one pending decision. Single dot only.
- **LLM scanner replacing regex** was considered but rejected — augment in parallel + dedupe is the chosen strategy. Don't remove the regex scanners.
- **Phase 6 gatekeeper "60s budget"**: the LLM call has a 30s timeout inside the existing 60s `asyncio.wait_for` envelope. If you need to extend either, update both.
- **n8n multi-tenancy** at `a3bb487` — see [memory/project-n8n-multitenancy.md] for the open gap (shared canvas across users blocks any demo).

---

## Prompt to paste into the next Claude Code session

> Read `docs/HANDOFF.md` end-to-end, then `CLAUDE.md` (sections 2, 5, 6, 9), then `PHASE_LOG.md`. After that, run `git status` and `git log --oneline -10` to confirm the working tree matches what HANDOFF claims. Don't trust the doc blindly — verify.
>
> Then audit the work that was shipped but never tagged: the Phase 6 LLM-gatekeeper extension, the vetting page redesign, the workspace home redesign. For each, check (1) does it match the rules in CLAUDE.md §2 (security review, plan, manual test, tag, log), (2) what's missing before it can be tagged, (3) any code smell you'd flag for review.
>
> Output a short punch list: per-phase, what's blocking tag. Don't fix anything yet — just report. Under 400 words.
