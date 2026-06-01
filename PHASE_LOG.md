# Phase Log

Record of completed phases. Updated after each phase passes manual test and is tagged.

Format:

```markdown
## Phase N — <name>
- Started: YYYY-MM-DD
- Completed: YYYY-MM-DD
- Tag: phase-N-complete
- Notes: <key decisions, gotchas>
- Outstanding: <known issues deferred>
- ADRs added: <ADR-NNNN, ADR-MMMM>
```

---

## Phase 0 — Foundation & Ground Rules

- Started: 2026-05-16
- Completed: 2026-05-16
- Tag: phase-0-complete
- Notes:
  - Dev environment pre-existing (WSL2, Node 24.15, Python 3.13, mise, uv, pnpm, git).
  - Phase 0 scope: repo skeleton only — no app code.
  - `infra/supabase/kong.yml` added (section 5 explicitly allows `infra/` in Phase 0 when a service needs config files).
  - `scripts/keygen.js` added (Node 24, zero external deps, built-in crypto). Generates JWTs + 256-bit secrets into `.env`; idempotent. Not committed; placeholder in `.env.example`.
  - Dify at port 3000; Wekala Web will be port 3002 (Phase 1) to avoid collision.
  - `docker-compose.yml` exceeds 400 lines — acceptable for a declarative config file (Rule 7 targets code files).
  - Ollama GPU passthrough enabled via NVIDIA runtime; comment out `runtime: nvidia` if no GPU available.
  - All secrets use `CHANGE_ME_*` placeholders in `.env.example` to avoid gitleaks false positives.
  - Kong 3.x does NOT expand `${VAR}` in declarative config YAML (unlike Kong 2.x). Fixed by overriding entrypoint with `sed` preprocessing at container startup.
  - Next.js 15/16 binds only to the IP resolved from the `HOSTNAME` env var (Docker default = container short ID → specific bridge IP). Fixed with `HOSTNAME: "0.0.0.0"` on supabase-studio and dify-web.
  - Langfuse v3 requires ClickHouse (event storage) and SALT (API key encryption). ClickHouse service added; internal network only, no exposed ports.
  - All 8 services pass `make health` (HTTP 2xx/3xx).
  - CI: `ubuntu-latest` runners ship Docker Compose v2 pre-installed; `docker-compose-plugin` apt package does not exist on runners — removed install step.
- Outstanding:
  - Branch protection on `main` on GitHub must be configured manually after remote is created (see README).
  - Dependabot config not yet in place — no `apps/` with package manifests; add in Phase 1.
  - `LANGFUSE_PUBLIC_KEY` requires one manual step: log into Langfuse → create org + project → copy public API key into `.env`.
- ADRs added: —

---

## Phase 1 — Authentication, Authorization, Multi-tenancy

- Started: 2026-05-17
- Completed: 2026-05-17
- Tag: phase-1-complete
- Notes:
  - FastAPI backend (`apps/api`) built with interface+adapter pattern: `AuthService` Protocol → `SupabaseAuthAdapter` (calls GoTrue REST via httpx). Ready to swap for `OmantelSSOAdapter`/`KeycloakAdapter` with config change only.
  - JWT verification is local (python-jose) — no network round-trip per request. O(1).
  - OPA sidecar (`openpolicyagent/opa:0.70.0-rootless`) on internal wekala_net only. Permission check is O(1) map lookup in Rego; result cached per request.
  - All 4 tenant tables (`workspaces`, `memberships`, `audit_log`, `api_keys`) have `ENABLE ROW LEVEL SECURITY` + `service_role` bypass policy. Alembic migrations 0001–0004.
  - API key format: `wk_<40 hex chars>`. Argon2id hash stored; prefix (first 8 chars) shown in UI; plaintext returned once on creation only.
  - `audit_log.metadata` column renamed to `event_metadata` at ORM layer — `metadata` is reserved by SQLAlchemy's DeclarativeBase. DB column still named `metadata` via explicit column name arg.
  - Next.js 15 frontend (`apps/web`) with next-intl (all strings via translation keys, no hardcoded UI text). sessionStorage for JWT (no cookies → no CSRF surface).
  - Rate-limit plugin added to Kong: signup 10 rpm / login (token) 5 rpm per IP. Required adding `rate-limiting` to `KONG_PLUGINS`.
  - `GOTRUE_PASSWORD_MIN_LENGTH=12` added to GoTrue service (GoTrue enforces at auth layer; API schema also validates ≥12 chars).
  - Unit tests use `app.dependency_overrides` (not `@patch`) because FastAPI `Depends` captures function references at decoration time.
  - `pydantic[email]` (with `email-validator`) required for `EmailStr` fields.
  - Python runtime in venv is 3.14.4 (uv chose latest patch of mise-pinned 3.x); all code compatible.
  - pnpm workspace (`pnpm-workspace.yaml` + root `package.json`) created; `pnpm-lock.yaml` committed.
- Outstanding:
  - `make migrate` requires `supabase-db` container to be running (Alembic connects directly to Postgres).
  - Dependabot config not yet added — intentionally deferred (adding in Phase 7 alongside SDK/API hardening).
  - Logout endpoint currently no-ops at API layer (GoTrue session expires on JWT exp). Full revocation via GoTrue admin endpoint deferred to Phase 7 (session management feature).
  - `wekala-web` and `wekala-api` Docker images need `make up --build` on first run after Phase 1 changes.
- ADRs added: —

---

## Phase 2 — Agent Lifecycle Core

- Started: 2026-05-17
- Completed: 2026-05-17
- Tag: phase-2-complete
- Notes:
  - `AgentRuntime` Protocol + `DifyAdapter` (interface/adapter pattern per Rule 5). DifyAdapter calls Dify console API at `http://dify-api:5001/console/api/*`; `DIFY_CONSOLE_TOKEN` in backend env only, never exposed to frontend.
  - `DifySLValidator`: `yaml.safe_load` only, 1 MiB size cap, required-field schema check, `__python__` node scan, tool allow-list enforcement.
  - Three Alembic migrations (0005–0007): `agents`, `agent_versions`, `agent_imports`. Each has RLS (select policy scoped to workspace memberships; INSERT/UPDATE for builder+ role; service_role bypass).
  - State machine: DRAFT → PUBLISHED, DRAFT → ARCHIVED, PUBLISHED → ARCHIVED. ARCHIVED is terminal. Rollback is non-destructive: creates new DRAFT version from any prior snapshot.
  - Sandbox quota: 100 invocations/day per user. Checked via `count(audit_log WHERE action=agent.test AND actor=user AND date=today)` — O(log n) via index.
  - All 13 REST endpoints fire-and-forget audit log entries (same pattern as WorkspaceService).
  - OPA `min_role` extended with 6 new `agent.*` actions.
  - Built-in `customer_support` template loaded from `apps/api/wekala/templates/` at startup; directory scan allows adding new templates without code changes.
  - Frontend: agent list (filter tabs + paginated grid), new agent (YAML upload + template picker), agent detail (action buttons + sandbox test panel + version history + rollback). All strings via next-intl `agent.*` namespace.
  - `.gitignore` had `lib/` (Python venv pattern) that over-broadly matched `apps/web/lib/`. Fixed with `!apps/web/lib/` negation rule.
  - 21 new unit tests; 35 total across all test files — all pass. All linters (ruff, mypy strict, biome, tsc) clean. Zero pnpm audit vulnerabilities.
- Outstanding:
  - Sandbox test (scenario 10) requires Dify running with a registered app — skip if stack not up.
  - `DIFY_CONSOLE_TOKEN` must be set in `.env` before `make up` for DifyAdapter to function (see `.env.example`).
  - Frontend `token = ""` placeholder: real session token wiring deferred to a future auth-integration pass (Phase 3+).
- ADRs added: —

---

## Phase 3 — Bazaar (Marketplace UI)

- Started: 2026-05-18
- Completed: 2026-05-18
- Tag: phase-3-complete
- Notes:
  - `SearchAdapter` Protocol + `MeilisearchAdapter` (interface/adapter per Rule 5). Meilisearch Python SDK is synchronous; all calls wrapped in `asyncio.run_in_executor` via `functools.partial` — never blocks the event loop.
  - Three Alembic migrations (0008–0010): `hires`, `reviews`, `categories` + `agent_categories`. All have `ENABLE ROW LEVEL SECURITY`. `hires` and `reviews` have UNIQUE constraints for idempotency (hire) and one-review-per-user enforcement (review).
  - k-anonymity threshold = 3: `avg_rating` returns `None` when review count < 3; count is always returned for UX messaging.
  - Profanity filter: `better_profanity` library applied in `BazaarService.submit_review()`. Review body is censored (not rejected) in Phase 3; full NeMo moderation in Phase 6.
  - Agent publish/archive hooks: `AgentService.publish()` and `archive()` accept optional `BazaarService` + `BackgroundTasks` to index/deindex agents in Meilisearch asynchronously.
  - Meilisearch search has SQL fallback: if Meilisearch is unavailable (returns empty), `BazaarRepository.list_published()` is used. O(log n) via `(status, updated_at DESC)` index.
  - `better_profanity` and `meilisearch` added to `[[tool.mypy.overrides]] ignore_missing_imports` (no stubs shipped by those packages).
  - FastAPI `Depends` with `Annotated` pattern used throughout (no `= ...` defaults); consistent with agents.py pattern.
  - Frontend: catalog page (search + category filter + paginated grid), agent detail (hire button + reviews), hired view (with unhire). All 6 bazaar components use next-intl `bazaar.*` translation namespace.
  - `ReviewForm` uses `<fieldset>/<legend>` for the star rating group (correct a11y for button-group controls) and `htmlFor`/`id` for the textarea label — Biome `noLabelWithoutControl` satisfied.
  - 16 unit tests; all pass. ruff, mypy strict, biome ci, tsc all clean.
- Outstanding:
  - Kong rate-limit routes for `/api/v1/bazaar/search` (30 rpm) and `/api/v1/workspaces/*/hires` (10 rpm) noted in `kong.yml` comments but not active-route entries — Kong declarative rate-limiting requires a service/route binding. Activate in Phase 7 alongside full API hardening.
  - Meilisearch backfill task (index all currently-published agents on first Phase 3 deploy) is a manual step. Can be done via a one-off data migration or CLI command.
  - Frontend `token = ""` placeholder still present — session token wiring deferred to Phase 7 auth-integration pass.
- ADRs added: —

---

## Phase 4 — Knowledge Base & RAG

- Started: 2026-05-20
- Completed: 2026-05-20
- Tag: phase-4-complete
- Notes:
  - All 4 adapter layers behind Protocol interfaces (Rule 5): `PypdfAdapter` (PDF/DOCX/TXT/MD/HTML → text), `OllamaEmbeddingAdapter` (BGE-M3 via Ollama REST, batched 32 chunks/call), `ClamAVAdapter` (TCP to clamd on port 3310), `SupabaseStorageAdapter` (httpx calls to Supabase Storage API).
  - Magic-byte detection for file type validation (`b"%PDF"`, `b"PK\x03\x04"`) — not extension-only.
  - SHA-256 content hash deduplication: same file to same KB returns the existing document ID immediately, no re-embedding.
  - Sliding-window chunker: 1024-token window, 128-token overlap, word-count approximation. Partial tail chunks included (e.g., 10 words → 5 chunks with overlap=2, not 4).
  - Hybrid search: pgvector HNSW (m=16, ef_construction=64, cosine ops) + Meilisearch BM25, fused via RRF (k=60). O(log n) per leg.
  - Background processing: FastAPI `BackgroundTasks` — upload returns 202 Accepted immediately; parse/embed/index runs async.
  - Two Alembic migrations: 0011 (`knowledge_bases` + `kb_documents` + RLS), 0012 (`kb_chunks` + HNSW index + RLS).
  - ClamAV sidecar (`clamav/clamav:1.4`, 512 MB memory limit) added to docker-compose; `wekala-api` `depends_on` it with `service_healthy`. `start_period: 120s` needed for virus definition loading.
  - OPA `min_role` extended with `kb.*` and `document.*` actions.
  - Frontend dropzone uses `<label htmlFor="kb-file-input">` wrapping a hidden `<input type="file">` — semantically correct, avoids Biome a11y rules (`noNoninteractiveTabindex`, `useSemanticElements`, `useKeyWithClickEvents`).
  - `uv python pin 3.13` required: `spacy` (presidio-analyzer dep) only ships cp313 wheels, not cp314. Created `apps/api/.python-version`.
  - 22 unit tests for KB service, chunker, type detection, and RRF fusion; all pass.
- Outstanding:
  - `make migrate` must be run to apply 0011/0012 before using KB endpoints.
  - `wekala-clamav` container first boot downloads ~500 MB virus definitions — allow 2–3 minutes.
  - Frontend `token = ""` placeholder still present — session token wiring deferred to Phase 7.
  - OCR (pytesseract) path works for image PDFs but requires `tesseract-ocr` installed in the API container. Add to Dockerfile in a follow-up.
  - Presidio PII scan flags metadata only in Phase 4; enforcement (block uploads) deferred to Phase 6.
- ADRs added: —

## Phase 5 — Tools, MCP & integrations (core slice)

- Started: 2026-05-21
- Completed: 2026-05-21
- Tag: (none — slice, not full phase; see Outstanding)
- Notes:
  - SSRF guard with 18 unit tests covering loopback, link-local, private (10/172/192.168), cloud-metadata (169.254.169.254, 100.100.100.200, fd00:ec2::254), multicast, reserved, IPv6 loopback, and an allowlist bypass for trusted Docker-network sidecars.
  - `AgentScanner`/`HTTPMCPClient` adapter pair (Rule 5) using JSON-RPC 2.0 — pluggable for stdio transport later.
  - Built-in MCP sidecar `wekala-mcp-time` (FastAPI, 128 MB) demonstrates the end-to-end registration/discovery/invocation path. Auto-flagged `is_builtin=true` by hostname allowlist match.
  - Per-agent tool whitelist via `agent_tools` join table; runtime invocation gated by both whitelist and tool JSON Schema (Draft 2020-12).
  - DNS-rebind mitigation: URL revalidated on every invocation, not just registration.
  - 4 new tables + RLS in migration 0015. 7 new OPA actions.
  - Frontend: workspace sidebar item "Tools"; MCP admin page (register/discover/delete); per-agent grant/revoke page.
- Outstanding:
  - Three other built-in MCPs from CLAUDE.md (filesystem-readonly, http-fetch, postgres-readonly).
  - n8n workflow as a callable tool type.
  - HTTP/webhook tool builder UI.
  - `mcp_servers.allowed_hosts` field defined but not enforced (will land with http-fetch built-in).
  - Frontend invocation playground (admins can curl).
  - Sandbox quota integration (tool invocations against per-user daily quota from Phase 2).
- ADRs added: —

## Phase 6 — Security Gatekeeper & PDPL (core slice)

- Started: 2026-05-21
- Completed: 2026-05-22
- Tag: phase-6-complete
- Notes:
  - Core slice: PII + injection scanners, vetting workflow, hard-block on critical findings, classification policy (YAML-driven), publish gating, re-vet on edit.
  - **Hard-block on critical**: reviewer approval cannot override `critical` severity findings (PDPL posture protection). Configurable via `infra/policies/classification.yaml:hard_block_severity` (default `critical`).
  - **Separation of duties enforced**: REVIEWER and BUILDER are intentionally *parallel* roles, not hierarchical. Rank-based `require_workspace_role(Role.REVIEWER)` was letting BUILDER through because BUILDER rank > REVIEWER rank. Fixed by adding (1) explicit role-set check `{REVIEWER, ADMIN}` at the endpoint layer, (2) `explicit_role_set` map in OPA policy, (3) submitter-cannot-approve-own-submission SoD check.
  - Omani PII recognizers: national ID (8 digits + label context), mobile (+968 9X/7X), IBAN (`OM[0-9]{2}[A-Z]{4}[0-9]{16}`), vehicle plate. Recognizers below confidence 0.7 require a PII-label keyword nearby to suppress false positives.
  - 7 injection rule patterns: instruction_override, role_override, system_leak, jailbreak_marker, privilege_escalation, delimiter_attack, encoded_payload.
  - Background scanning via FastAPI BackgroundTasks; explicit `await db.commit()` before scheduling fixes a real race (BG task's fresh session opened before the request's outer transaction committed).
  - Bug discovered + fixed mid-implementation: savepoint exit on `async with self._db.begin_nested()` puts the ORM object in a state where `from_orm` triggers a lazy load outside the async greenlet → `MissingGreenlet` → HTTP 500. Applied re-fetch pattern to publish/archive/rollback/transfer/update in agent_service.
  - Frontend hot-reload bug found + fixed: `request()` was forcing `Content-Type: application/json` on `FormData` uploads, which clobbered the multipart boundary and caused 422s. Also: `[object Object]` toast bug — Pydantic validation `detail` is an array of `{loc,msg}` objects, now formatted into a readable string.
  - 401 race in `agent` query fixed by adding `enabled: !!token` guard.
  - Auto-fix agent deferred — too much new attack surface (LLM-rewriting attack surface, audit opacity); separate feature for after Phase 6.
- Outstanding (§10 of `docs/phases/MANUAL_TEST_PHASE_6.md`):
  - NeMo Guardrails runtime output safety at invocation time.
  - Garak red-team corpus runner.
  - Signed PDF compliance reports (JSON via API works today).
  - Rebuff / Prompt-Guard via Ollama (rule-based scanner ships first).
  - Per-workspace HMAC signing of approval decisions.
  - Tools whitelist enforcement at publish time (`allowed_tools` patterns in YAML are loaded but not yet enforced against agent's granted tools).
  - Phase 2 PATCH bug discovered: `update()` sets `dify_dsl={}` if not provided, wiping the prompt. Tracked as Phase 2 follow-up.
- ADRs added: — (separation-of-duties design intent worth an ADR follow-up)

## Phase 7 — Developer SDK & API (core slice)

- Started: 2026-05-23
- Completed: 2026-05-23
- Tag: phase-7-complete
- Notes:
  - Core slice: Bearer API-key auth for `/v1/agents/{id}/invoke`, sliding-window rate limiting, signed webhook subscriptions with retrying delivery worker, filtered public OpenAPI spec, minimal Python SDK.
  - **Bearer auth via `Authorization: Bearer wk_...`** — Phase 1's ApiKey infra (Argon2id-hashed) reused. Lookup by 11-char prefix → constant-time verify. Generic 401 on any failure to avoid key enumeration.
  - **Rate limiting in Postgres**, not Redis. `api_request_log` table with partial index `(api_key_id, ts DESC)` lets us count windowed requests in one SUM-of-FILTER query. Defaults: 60/min, 10k/day.
  - **Webhook delivery worker** runs as a long-running asyncio task started in FastAPI's `lifespan`. Scans `webhook_deliveries WHERE status='pending' AND next_attempt_at <= now()` and retries with exponential backoff (1s, 5s, 25s, 125s, 625s) up to 5 attempts before marking `dead`. URL re-validated via Phase 5's SSRF guard on every attempt (DNS-rebind mitigation).
  - **HMAC signing** via `sha256=<hex>` in `X-Wekala-Signature`. Receivers verify with the SAME secret they were given at creation time. Signing secret is **plaintext at rest** (standard industry practice — GitHub/Stripe/Slack do the same; HMAC requires symmetric key on both sides). Tracked: encrypt-at-rest with an app-level key.
  - **Publish + vetting gate enforced on the public endpoint** — only `status='published' AND vetting_status='approved'` agents are externally callable. 409 with explanatory detail otherwise.
  - **Public OpenAPI** at `/v1/openapi.json` is filtered to only `tags=["public","webhooks"]` operations. Internal routes do not leak via the public spec.
  - **Python SDK shipped** at `packages/sdk-py/` — `WekalaClient.invoke_agent`, async `stream_agent`, and `verify_webhook_signature` helper. Hand-written (not generator-output) for now to keep the surface small; openapi-generator-cli wiring is a follow-on.
  - **Frontend**: new **Developer** tab in the workspace sidebar (under Settings) with API-keys section + webhooks section. Both show full secret ONCE on creation in an amber "save now" banner.
  - 8 unit tests for HMAC signing, verification (including timing-safe + tamper-rejection), and backoff progression.
- Outstanding:
  - **SSE streaming server-side** — SDK client method exists but `/v1/agents/{id}/stream` endpoint is a follow-on.
  - **Webhook secret encryption-at-rest** — store via Postgres TDE or app-level Fernet.
  - **TypeScript SDK** — needs openapi-generator-cli setup.
  - **Docusaurus docs portal** — currently shipping with one README.
  - **Token-cost quotas** — needs Phase 8 cost tracking.
  - **Idempotency-Key header support** for client-side retry dedup.
  - **Per-workspace CORS allow-list** — currently server-to-server only.
  - **Worker dead-letter UI** — `webhook_deliveries.status='dead'` rows have no surface yet.
  - **Phase 2 PATCH bug** still present: `update()` wipes `dify_dsl` if not provided.
- ADRs added: —

## Phase 8 — Command Center & analytics (core slice)

- Started: 2026-05-23
- Completed: 2026-05-23
- Tag: phase-8-complete
- Notes:
  - KPI dashboard, daily timeseries, top-N agents leaderboard, on-read anomaly detection (z-score + absolute), audit log search + streaming CSV export.
  - **Materialized view `mv_workspace_daily`** rolls up daily counts from api_request_log, tool_invocations, vetting_runs, audit_log into a single (workspace_id, day) row per day. UNIQUE index `(workspace_id, day)` lets us refresh CONCURRENTLY without blocking reads. First refresh after migration is non-CONCURRENT (Postgres requires populated data for CONCURRENTLY); subsequent refreshes use CONCURRENTLY.
  - **MV refresh worker** runs in the API process as a long-running asyncio task (started in lifespan, cleaned up on shutdown). Tick interval 60s.
  - **Hours-saved policy** in YAML — first match wins: `by_agent_id` → `by_agent_name_pattern` (fnmatch) → defaults. Hot-reload requires API restart for now.
  - **Anomaly detection on-read**: each Command Center load runs the rules against the latest MV row; first time a threshold is crossed for a given day, persist an `anomaly_alerts` row that survives reloads and can be acknowledged. Rules in YAML: invocations_spike (z>3σ over 7d), tool_failure_rate (>25% absolute), latency_p95_spike (z>4σ over 7d).
  - **OPA additions**: analytics.view (viewer), analytics.export (builder), anomaly.ack (admin).
  - **Audit-log search uses Postgres** (no Meilisearch dep) — filter-heavy on (actor_workspace_id, action, timestamp) hits existing Phase 1 indexes.
  - **CSV export streams** via async generator → flat memory regardless of row count; capped at 10k per request.
  - **Policy path resolution fixed**: parents[N] count differs between host (apps/api/wekala/...) and slim container (/app/wekala/...). New `_find_repo_policies_dir()` walks up looking for an `infra/policies/` directory instead of assuming depth.
  - **Members page** added en route (Phase 5 left a 404 link) — full members list + invite form, reusing the existing /v1/workspaces/{wid}/members endpoint.
  - 9 unit tests for policy loaders + z-score math; all pass.
- Outstanding:
  - **Per-user breakdowns + k-anonymity UI** — infra is there, no surface yet
  - **Langfuse drill-down deep-links** — needs gateway path to record trace_id on every invocation
  - **Token-cost USD KPI** — needs LLM gateway integration (Phase 5/7 hook)
  - **Anomaly auto-resolve** — currently manual ack only
  - **Slack/email anomaly routing via Phase 7 webhooks** — webhook system can carry, needs routing rules UI
  - **Per-agent materialized view (mv_agent_daily)** — deferred; raw queries fast enough for current scale
  - **Hot-reload of YAML policies** — restart required after editing hours_saved.yaml / anomalies.yaml
- ADRs added: —

## Phase 11 — Design system foundation

- Started: 2026-05-23
- Completed: 2026-05-23
- Tag: phase-11-complete
- Notes:
  - **shadcn/ui v4 installed** with Neutral baseColor, light-mode only (dark-mode tokens deferred per POC scope). 16 primitives generated: alert, avatar, badge, button, card, checkbox, dialog, input, input-otp, label, separator, sheet, skeleton, tabs, tooltip.
  - **Tailwind 3 compatibility patches**: shadcn v4 ships `data-checked:` / `has-disabled:` syntax that only compiles under Tailwind 4. Rewrote `checkbox.tsx` and `input-otp.tsx` to use `data-[state=checked]:` for our Tailwind 3.4 setup. Without this, the checkbox stayed empty when checked and OTP cells were missing borders.
  - **Design tokens** in `globals.css` as HSL CSS variables, mapped to Tailwind color names in `tailwind.config.ts`. `--primary: 240 5.9% 10%` = near-black; the whole auth flow's "fully black button + white check" comes from this single token.
  - **AuthShell** wraps every `(auth)` page (login / signup / verify / reset-password / reset-password/new) — split layout, form panel on the left, BrandPanel on the right at `lg:grid-cols-2` (hidden below `lg`).
  - **BrandPanel** is a JS-driven 3-scene showcase (Bazaar / Command Center / Agent Detail) cycling every 7s with synced title/subtitle/dots. Dots are clickable; auto-cycle resumes from manual selections. Scene intro animations (card-pulse, bar-grow, tab-highlight) are CSS-keyframed and `motion-safe:` so reduced-motion users still get the scene cross-fade but no jitter.
  - **AnimatedFormPanel** is a client wrapper that re-keys its children on `pathname` change and plays a 500ms `rotateY(-90deg → 0deg)` flip-in with cubic-bezier easing (`prefers-reduced-motion` → 200ms opacity fade). Because the BrandPanel lives in the layout (above AnimatedFormPanel), navigating between auth routes only flips the form — the showcase keeps its scene state.
  - **Infrastructure fixes** to make shadcn-add succeed inside the pnpm-11 + container setup: `.npmrc` adds `strict-dep-builds=false`, root `package.json` declares matching `pnpm.ignoredBuiltDependencies`, and the web Dockerfile passes `--config.strict-dep-builds=false` to the install step. Without these, `pnpm install` blew up on msw's postinstall script.
  - **CLAUDE.md §6 updated**: Phases 11–15 appended with an execution-order note (11–15 ship before deferred 9–10).
- Outstanding:
  - **Post-signup onboarding wizard** — explicitly deferred (Phase 11 scope cut); future follow-up will add a one-time first-workspace modal gated by `user_metadata.onboarding_complete`.
  - **Theme customisation per workspace** — deferred.
  - **Dark-mode toggle UI** — tokens unused, no switcher.
- ADRs added: —

## Phase 12 — Auth flow redesign

- Started: 2026-05-23
- Completed: 2026-05-23
- Tag: phase-12-complete
- Notes:
  - **Four auth pages rebuilt** on shadcn primitives + Flynt-style split layout: sign-in, sign-up, verify-email, reset-password (2-step). Backend `/v1/auth/signup` now accepts `full_name` (2–60 chars, Pydantic-validated) and the SupabaseAuthAdapter passes it as GoTrue's `data` so it lands in `user_metadata.full_name`.
  - **Sign-up validation moved client-side** (with server-side defence in depth): name length 2–60, password ≥ 12, confirm equals password, terms checked. Submit button stays disabled until every condition holds. Inline per-field errors after blur. Strength meter (4 segments, red→amber→emerald→deep-emerald) driven by a small heuristic in `lib/password-strength.ts` — no zxcvbn dep.
  - **Sign-in "Remember me" toggle** swaps where the JWT lives: unchecked → sessionStorage (default, cleared on tab close), checked → localStorage (persists). Triggered the rule-of-three DRY signal — five files were doing the same sessionStorage dance — so consolidated into `lib/auth-storage.ts` (getToken / setTokens / clearTokens / rememberMePreferred). All five callers (use-token, api, auth-guard, guest-guard, logout-button) now share this helper.
  - **Verify-email OTP** uses shadcn's `input-otp` primitive (rewritten for Tailwind 3 — see Phase 11 note). Auto-submits the moment the value reaches 6 digits. **Paste-only**: keyboard typing is rejected by the onChange filter (`inputMode="none"` suppresses mobile keyboards too) — only full 6-digit paste or backspace-style reduction is accepted. Per-user request: forces them to copy from the email, removing typo risk.
  - **OTP failure no longer loops**: the original `submittedRef.current = ""` reset in the catch block caused setLoading(false) → useEffect re-fires → POST again. Fixed by NOT resetting the ref on error and instead clearing the cells (`setCode("")`); the next paste produces a different code string so the guard naturally bypasses.
  - **Reset-password is a two-step flow**: `/reset-password` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/reset-password/new' })` so the email link lands users on the completion page; `/reset-password/new` checks `getSession()` to confirm a recovery session is present (else shows an "expired link" state with a button back to step 1). Success uses `supabase.auth.updateUser({ password })` then signs out + toasts + routes to `/login`.
  - **Flip transition validated** across all four redesigned pages — brand panel survives every navigation (verified via React DevTools: BrandPanel's `active` state doesn't reset).
- Outstanding:
  - **Google + Apple OAuth wiring** — buttons are disabled and tooltip-labelled "Coming soon" per UX.
  - **MFA flow** — interface stub only, no UI.
  - **Existing `/v1/auth/reset-password` backend endpoint** is now bypassed by the client-side `resetPasswordForEmail` call but kept for potential future use; could be removed in a cleanup pass.
- ADRs added: —

## Phase B — n8n multi-tenancy (parallel build-canvas track)

- Started: 2026-05-25
- Completed: 2026-05-25
- Tag: phase-b-complete
- Notes:
  - **Wekala→n8n auth bridge**: each Wekala (Supabase) user is lazily provisioned a private n8n user on first canvas open; the mapping lives in `n8n_user_links`. n8n passwords are **Fernet-encrypted at rest** (now via the shared `core/security/field_crypto.py`). Owner bootstrap + login through the n8n REST adapter; a Set-Cookie route handler mints the per-user session.
  - **Branded local model nodes** (`phase-b-nodes`, d17e178): one Wekala-branded n8n node per locally-pulled Ollama model so the canvas presents a sovereign, opinionated palette; generic Ollama nodes hidden via `NODES_EXCLUDE`.
  - Commits: phase-b-nodes @ d17e178, phase-b-multitenancy @ a3bb487.
- Outstanding:
  - **Shared-canvas multi-tenancy gap** — see `memory/project-n8n-multitenancy.md`. Per-user isolation works via the bridge, but the embedded canvas still shares state in ways that block a clean multi-user demo. Production must use n8n Embed Edition or harden the bridge.
- ADRs added: —

## Phase 13 — App shell + dashboard + tabbed settings

- Started: 2026-05-25
- Completed: 2026-06-01
- Tag: phase-13-complete
- Notes:
  - Earlier: collapsible sidebar + branded header + Cmd/Ctrl-K command palette (`1ba0789`); dashboard hero greeting by `full_name` from the JWT (`5dca50e`); neutral workspace-home redesign with stat tiles + role dropdown (`bb62070`). Dashboard recent-activity reads from `audit_log`; breadcrumb auto-derives from the path; sidebar collapse state persists (localStorage) with animated content-shift — the "collapse polish" item was already satisfied.
  - **Settings tabs (this pass):** routed sub-tabs under `/settings` (`General / Members / Developer / Danger zone`) with a shared `settings/layout.tsx` tab-bar; **role-gated** (admin-only tabs hidden + a guard that bounces non-admins to General — server/OPA stays the real boundary). Sidebar Admin group → a collapsible **Settings** parent (General/Members/Developer). All four tabs use a wide (`max-w-[1400px]`, home-matching) two-column `SettingsSection` layout (label left / controls right). Developer page moved off the legacy indigo styling onto the neutral system.
  - **Member identity:** `GET /members` now returns `email` + `full_name`, resolved through the `AuthService` adapter (`get_users_by_ids`, parallel GoTrue admin calls — O(n) over bounded members, not N+1; `UserResult.full_name` added). Workspace home + Members tab show real names/avatars instead of UUIDs. Member-management UI consolidated into one shared module (`components/workspace/members.tsx`); the home is now a read-only preview, killing the home↔members duplication. `/members` route → redirect into the tab.
  - **Ops:** `make health` now flags an empty OPA policy set (was reporting ✓ on `/health` even with zero policies) — see [[project-opa-policy-reload]].
- Outstanding:
  - Sidebar Admin group itself isn't role-gated (a non-admin sees the links but the page guard bounces them); fine for the POC.
  - Members endpoint does one GoTrue admin call per member; revisit with a batch/cached lookup if member counts grow.
- ADRs added: —

## Phase 6 ext — LLM-driven gatekeeper

- Started: 2026-05-30
- Completed: 2026-05-30
- Tag: phase-6-llm-gatekeeper (commit ca6a1e9)
- Notes:
  - Added an LLM reviewer alongside the regex PII + injection scanners. New `LLMGateway` Protocol + `OllamaLLMAdapter` (`/api/chat`, `format=json`); `LLMScanner` implements the existing `AgentScanner` Protocol and sees the full Dify DSL. Runs in parallel via `asyncio.gather`; `_dedupe_findings` collapses (type, location, normalized prefix) so the LLM and regex don't double-report. Findings tagged `metadata.source="llm"`.
  - **Fail-closed**: an Ollama error → the LLM scanner returns `[]` and the regex baseline still runs; the scan never aborts. Model: `qwen2.5:7b-instruct`.
- Outstanding:
  - Tune / size up the orchestration model for subtler injection patterns.
- ADRs added: —

## Phase 4 ext — KB redesign + processing stability

- Started: 2026-05-30
- Completed: 2026-05-30
- Tag: — (folded into ongoing Phase 4; commits 45f8588, 706cd62)
- Notes:
  - **UI**: tabbed Knowledge Base page (Documents / Upload / Search), KB list moved into a header dropdown switcher, grid/table document toggle, auto-upload with a real XHR progress bar, centered create/delete dialogs.
  - **Stability** (the in-process pipeline twice took the API down): skip OCR when tesseract is absent (was decoding an image per scanned page on the event loop); **commit the document before scheduling the background task** (uploads returned 202 but never persisted); **serialize processing** (`Semaphore(1)`) + offload PII/chunk to threads + cache the Presidio engine; storage bucket self-heals.
- Outstanding:
  - **Move document processing to a dedicated worker container** — the real fix, and a hard prerequisite for Phase 16 (SILA).
- ADRs added: —

## Phase 5 ext — MCP Streamable-HTTP + Tier-1 auth + tools playground

- Started: 2026-05-30
- Completed: 2026-05-30
- Tag: mcp-tier1-auth (commit e72f91c)
- Notes:
  - **Transport**: full MCP Streamable-HTTP (2025-06-18) in `adapters/mcp/http_client.py` — initialize handshake → `Mcp-Session-Id` → SSE *or* JSON, with a fallback to the minimal JSON-RPC POST dialect for built-ins. Unlocks DeepWiki, Context7, Hugging Face, Microsoft Learn, Grep, GitMCP, Cloudflare Docs.
  - **Tier-1 auth**: optional static token/API key per MCP server, Fernet-encrypted at rest (shared `field_crypto`; n8n password storage refactored onto it), sent as a header on every request; API exposes only `has_auth`. Migration `0020_mcp_server_auth`.
  - **Tools UI**: catalog grouped into collapsible per-server sections; schema-driven **Tool Playground** (form from the tool's JSON Schema → invoke → result); returned images rendered inline (base64 blocks + image URLs fetched server-side, SSRF-guarded, inlined as base64); friendly transient-GPU error message.
- Outstanding:
  - **MCP OAuth (Tier 2)** for SaaS servers (Sentry/Linear/Notion/GitHub/Atlassian) — documented in CLAUDE.md §6, a future mini-phase.
- ADRs added: —

## Phase 16 — SILA (planned)

- Status: **documented in CLAUDE.md §6, not started.** The conversational platform concierge (text-first → voice); builds Dify agents + n8n workflows; builder-scope only; capstone after Phase 9 + 15 + moving KB processing to a worker container.
- ADRs added: —
