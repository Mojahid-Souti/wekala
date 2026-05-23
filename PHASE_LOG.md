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
