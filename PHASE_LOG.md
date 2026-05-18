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
