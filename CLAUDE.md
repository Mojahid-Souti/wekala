# CLAUDE.md — Wekala Platform

> This file is the development guide for the Wekala platform. Read it at the start of every coding session. If anything in this file conflicts with a verbal request, ask before deviating.

---

## 1. Project context

**What is Wekala?**
A sovereign AI agent marketplace and factory. Teams discover, customize, and "hire" pre-vetted AI agents from a Bazaar UI. All data stays on local infrastructure. PDPL-compliant by design.

**What you (Claude Code) are building:**
The *platform*. The features that let agents be built, imported, vetted, hired, and run.

**What you are NOT building:**
The agents themselves. Mojahid's teammates build agents (using Wekala's import + customize features) and ship them as Dify YAML files. The Voice Agent is the first such agent — it is built by teammates, not by you.

**POC vs production:**
This POC runs on Mojahid's laptop (32GB RAM, RTX 5070 Ti 12GB VRAM, 24 cores, 1TB SSD). Everything must be *production-ready in design* but *production-deployed later*. See Rule 5.

**Language strategy:**
Build the entire platform in **English first**. Architecture is i18n-ready from day one (next-intl on the frontend, translation keys instead of hardcoded strings, no language assumptions in the DB). Arabic UI translation and full RTL support are deferred to a dedicated localization pass after Phase 9. Do not invest in RTL CSS, Arabic fonts, or `ar-*` locale handling during phases 0-9 beyond keeping the architecture ready for it.

---

## 2. Working rules — read every session

These rules govern how you work on this codebase. Violating them = redo the work.

### Rule 1 — Security review BEFORE every phase

Before starting any phase, run the phase's security review checklist (in section 6) and report findings as a markdown table.

For every phase, check at minimum:
- Secrets/credentials introduced
- New attack surfaces (endpoints, file uploads, user inputs)
- New authorization boundaries
- Threat model coverage (section 9)
- RLS policies for any new Postgres tables
- Audit log entries for any state-changing actions

Output the security review before writing any code. Wait for Mojahid's approval.

### Rule 2 — Plan BEFORE implementing

For any task larger than a single small change:

1. Output a written plan with:
   - Files to be created/modified (full paths)
   - Database migrations needed
   - API endpoints to be added (path, method, request/response schema)
   - Algorithm choice with time/space complexity in Big-O
   - Estimated diff size (lines added/removed, files touched)
   - Risks and unknowns
   - Dependencies on previous phases
2. Wait for Mojahid's approval.
3. Only then write code.

If the plan changes mid-implementation, stop and update the plan.

### Rule 3 — Manual test checklist AFTER each phase

When a phase's code is done, output a `MANUAL_TEST_PHASE_<N>.md` file in `docs/phases/` with:
- Numbered scenarios (happy path + edge cases + failure cases)
- Exact steps to reproduce each scenario
- Expected outcome
- Where to look for evidence (logs, DB rows, UI elements)
- Pass/fail checkbox

Mojahid runs the tests. He marks pass/fail and reports back. Fix failures before requesting tag.

### Rule 4 — Restore points

After every phase passes manual test:
- Tag the commit: `git tag -a phase-N-complete -m "Phase N: <name>"`
- Push the tag: `git push origin phase-N-complete`
- Record in `PHASE_LOG.md`

Within a phase:
- Tag working commits as `phase-N-checkpoint-M` if worth preserving
- Before any risky refactor, tag a `pre-refactor-<short-name>` checkpoint
- Recommend `git tag` to Mojahid before any destructive operation

### Rule 5 — Production-ready, not production-deployed

The POC runs on a laptop. The codebase ships to production later. Every integration point uses the **interface + adapter** pattern.

Examples:
- Auth: `AuthService` interface → `SupabaseAuthAdapter` (now) → `KeycloakAdapter` or `OmantelSSOAdapter` (later)
- Secrets: `SecretsProvider` interface → `EnvSecretsAdapter` (now) → `VaultAdapter` (later)
- LLM: `LLMGateway` interface → `LiteLLMAdapter` (routes to Ollama / Anthropic / OpenAI etc.)
- Storage: `ObjectStore` interface → `SupabaseStorageAdapter` (now) → `S3Adapter` or `MinIOAdapter` (later)
- Email: `EmailService` interface → `MailHogAdapter` (dev) → `SMTPAdapter` (prod)
- Identity classification: `ClassificationProvider` interface → synthetic test data (now) → Omantel data dictionary (later)

Rules:
- **No Omantel-specific values hardcoded.** All env-driven.
- **No POC shortcuts in business logic.** Shortcuts only at the adapter layer.
- **Test for production readiness:** "Could ops deploy this with only config changes?" If no, redesign.

### Rule 6 — Algorithmic thinking, complexity, and clean code ⭐

**Think before you code.** Every non-trivial problem starts with: what is the input shape, what is the expected output, what is the worst-case size, what data structure makes the operation natural, what is the time and space complexity. Write this as a comment block before the function, then implement.

**Every non-trivial function declares its complexity** in the docstring (Big-O for time and space, with a short note on what *n* represents).

**Algorithmic standards (non-negotiable):**
- Hot paths (request → response): must be O(log n) or O(n) over user-scoped data. **No O(n²) over workspace data.**
- Background jobs: O(n²) tolerated only if n is provably bounded (e.g. tools per agent < 50, with assertion)
- Search and filter: always use indexes — never scan a table
- Vector search: HNSW (pgvector), not flat
- Embedding generation: batched (never one-at-a-time in a loop)
- Streaming preferred over polling for any wait > 200ms
- Async I/O everywhere — no blocking calls in request handlers
- Pagination required on any list endpoint that could return > 100 rows (default page size 20, max 100)
- N+1 query patterns are bugs — fix with joins or batch loading
- Cache lookups before recomputation; invalidate explicitly, never time-based for correctness-critical data
- Use the right data structure: hash map for lookup, set for membership, heap for top-k, sorted list for ranges. Wrong-structure choice = redo.

**Anti-patterns that will be rejected in review:**
- Nested loops over user data without a complexity comment justifying it
- Re-fetching the same row in the same request
- Computing the same value twice in the same function (memoize or pass it)
- Building a string in a loop with `+` instead of `join` or a buffer
- Sorting just to find the min/max
- Loading the whole table to filter in memory
- Sync version of an async operation in a request handler
- "Just for now" hacks without a TODO and a phase tag

**Problem-solving discipline:**
- Solve on paper (or comment) first for any algorithm beyond CRUD
- Identify the constraints (input size, latency budget, memory budget) before choosing
- Pick the simplest data structure that meets the constraints — don't over-engineer
- Verify with a counter-example: pick the worst input you can imagine, walk through the algorithm
- Test edge cases: empty input, single element, max size, duplicates, unicode, negative, null

**Clean, readable, bug-resistant code:**
- A function does **one thing**. If you describe it with "and", split it.
- Name things for what they *mean*, not what they *are*. `active_agents` not `agent_list_2`.
- Prefer pure functions: input → output, no side effects, easy to test.
- Make invalid states unrepresentable in types (enums, unions, Pydantic validation).
- Fail fast and loud at boundaries; be lenient in internals.
- Code is read 10x more than written — optimize for the reader.

Before choosing an algorithm, explain why in the plan (Rule 2).

### Rule 7 — Programming best practices

- **Naming**: snake_case in Python, camelCase in TS, kebab-case for files. No single-letter variables outside math/loops.
- **Functions**: ≤ 40 lines preferred. If longer, split.
- **Types**: every public function has full type annotations. Pydantic models for API I/O.
- **Errors**: never `except: pass`. Always log + re-raise or handle specifically. Catch the narrowest exception possible.
- **Comments**: explain *why*, not *what*. The code shows what.
- **Tests**: each new feature ships with at least one happy-path test + one failure test.
- **Imports**: absolute imports only. Sorted by Ruff/Biome.
- **No magic strings/numbers**: extract to a config or constants module.
- **No god files**: max ~400 lines per file.
- **Single responsibility**: one module = one concern.
- **Dependency direction**: domain layer never imports adapter layer. Adapters import the interface they implement.
- **Idempotency**: any operation that can be retried should be idempotent (or explicitly marked non-idempotent).
- **Logging**: structured (JSON), with trace IDs. No `print()` outside scripts.

**Don't Repeat Yourself (DRY):**

If a function, type, constant, component, query, or validator is used in more than one place — **extract it**.

Where extracted code lives:
- Shared utility functions (Python) → `apps/api/wekala/core/utils/`
- Shared utility functions (TS) → `apps/web/lib/`
- Shared types between frontend and backend → `packages/shared-types/` (auto-generated from OpenAPI)
- Shared React components → `apps/web/components/` for UI primitives; co-located in the feature folder for feature-specific ones
- Shared constants → `apps/api/wekala/core/constants.py` or `apps/web/lib/constants.ts`
- Shared DB query logic → repository classes in `apps/api/wekala/db/repositories/`
- Shared validation → `apps/api/wekala/core/validators/`

**Rule of three:** first time → write inline. Second time → still inline but flag with `# DRY-CANDIDATE: <reason>`. Third time → extract immediately.

**Extraction signals to act on:**
- Copy-paste with minor tweaks → extract + parameterize
- "Almost-the-same" functions in two files → extract the common shape
- Repeated SQL/ORM queries → move to a repository method
- Repeated validation logic → extract a validator
- The same hard-coded value in two places → extract a constant
- Two React components with similar JSX → extract a shared component or hook

**Do not over-abstract:**
- One-line lambdas, framework boilerplate, and trivial wrappers can stay duplicated
- Premature abstraction is worse than duplication — wait for the third use
- "Could be reusable someday" is not a reason to extract

### Rule 8 — When to ask vs when to proceed

**Ask Mojahid when:**
- Requirements are genuinely ambiguous (more than one reasonable interpretation)
- A decision will be hard to reverse (DB schema, API contract, major dependency)
- Security trade-off is involved
- Estimated effort doubles unexpectedly
- A dependency you'd like to add isn't in the approved list (section 4)
- A new file would exceed 400 lines

**Proceed without asking when:**
- Naming a variable
- Choosing between two equivalent implementations
- Adding a missing test
- Fixing an obvious bug discovered in passing
- Refactoring within an already-touched file (under 50 lines of refactor)

When you do proceed, state the assumption inline in your output: "Assumption: X. If wrong, tell me."

### Rule 9 — Memory budgets per service

Mojahid's laptop has 32GB RAM. Stay under budget so dev is fluid:

| Service | Max RAM |
|---|---|
| Postgres (Supabase) | 2 GB |
| Supabase rest (kong, gotrue, realtime, storage, studio) | 2 GB |
| Dify (web + api + worker) | 3 GB |
| Langfuse | 1 GB |
| Meilisearch | 512 MB |
| n8n | 512 MB |
| Ollama (model loaded) | 12 GB VRAM (off RAM) |
| Wekala app dev (Next.js + FastAPI) | 2 GB |
| MCP servers (built-in) | 1 GB total |
| **Total in use** | **~12 GB RAM + 12 GB VRAM** |
| **Free for OS + browser + IDE** | **~20 GB RAM** |

If a service exceeds budget, fix it (config, model size, cache size). Document the budget per service in `docker-compose.yml` as resource limits.

### Rule 10 — Commits

Conventional Commits enforced.

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`, `security`, `revert`.

Scope = phase name or area (e.g. `phase-1-auth`, `bazaar-ui`, `gatekeeper`).

Examples:
- `feat(phase-1-auth): add workspace invitation flow`
- `security(gatekeeper): tighten PII detection on agent prompts`
- `fix(bazaar-ui): RTL alignment on agent detail page`
- `perf(rag): batch embedding calls; 5x throughput`

Body of commit message must mention any breaking change with `BREAKING CHANGE:` prefix.

---

## 3. Hardware and model defaults

**Local machine:**
- 32GB DDR5 RAM
- NVIDIA RTX 5070 Ti, 12GB VRAM
- 24 cores
- 1TB SSD

**Default models (configurable via .env):**
- LLM: `qwen2.5:7b-instruct` (Ollama tag) — strong Arabic, fits 12GB VRAM
- Arabic-specialized fallback: `jais:13b` (quantized) if needed
- Embeddings: `bge-m3` (multilingual)
- Reranker (Phase 4+): `bge-reranker-v2-m3`
- STT (Phase 9): `faster-whisper-large-v3` (8-bit)
- TTS (Phase 9): `piper` with Arabic voice (`ar_JO-kareem-medium` initially)
- VAD (Phase 9): `silero-vad`

Models pulled by `make pull-models` on first run. Model choice abstracted via `LLMGateway` interface (Rule 5) so production can swap to larger models with one config change.

**Development environment (set up and verified):**
- OS: Windows host, all development inside **WSL2 + Ubuntu**. Never develop from `/mnt/c/...`; the repo lives at `~/GenZ_Project_Wekala` on the Linux filesystem.
- Editor: VS Code connected to WSL via the Remote-WSL extension (title bar must show `[WSL: Ubuntu]`).
- Tool version manager: **mise** (pins Node + Python per project).
- AI pair programmer: Claude Code, run inside the WSL terminal.

**Pinned runtime versions (do not bump major versions without an ADR):**
- Node.js: **24.x** (Active LTS — `mise use --global node@24`). Not 25/26 (Current, non-LTS).
- Python: **3.13.x** (`mise use --global python@3.13`). Not 3.14 (too new for the ML deps) and not 3.12 (security-only).
- Package managers: **uv** for Python, **pnpm** for Node.

**Docker base images (use exactly these — never `latest`, never a newer major):**
- Node containers → `node:24-slim`
- Python containers → `python:3.13-slim`

---

## 4. The tech stack (frozen for v1)

Adding a new dependency requires Mojahid's approval (Rule 8).

**Runtime services (Docker):**
- Supabase (Postgres + pgvector + GoTrue + Storage + Realtime + Studio)
- Dify (agent runtime)
- n8n (connector for 500+ apps)
- Ollama (LLM serving)
- Langfuse (LLM observability)
- Meilisearch (search engine)
- LiveKit (added Phase 9)

**Languages / frameworks:**
- Frontend: Next.js (App Router) + TypeScript, on Node.js 24.x
- Backend: FastAPI on Python 3.13.x
- DB layer: SQLAlchemy + Alembic (migrations)
- Frontend libs: shadcn/ui, Tailwind CSS, TanStack Query, Recharts, TanStack Table, next-intl
- Backend libs: Pydantic, httpx, LiteLLM, Presidio, NeMo Guardrails (Phase 6), Pipecat (Phase 9)
- Phase 10 only (do not install before then): `tailwindcss-rtl`, Tajawal/IBM Plex Sans Arabic fonts, CAMeL Tools

**Tools (local dev — installed and verified):**
- Docker Compose
- mise (tool version pinning — Node + Python)
- uv (Python package manager)
- pnpm (Node package manager, via corepack)
- Make (task runner)
- pre-commit (git hooks — installed in Phase 0)
- Biome (JS/TS lint+format), Ruff (Python lint+format)
- pytest, Vitest, Playwright
- gitleaks (secret scanning — installed in Phase 0)
- Bruno (API testing)
- Claude Code (AI pair programmer)

---

## 5. Repository layout — grow as needed

**Do not pre-create folders or scaffolding for future phases.** Start with the minimum below. Add files and folders only when a phase actually needs them. An empty folder is a smell.

**Day-one starter (Phase 0 only):**

```
wekala/
├── CLAUDE.md
├── README.md
├── PHASE_LOG.md
├── .gitignore
├── .env.example
├── .pre-commit-config.yaml
├── docker-compose.yml
├── Makefile
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        └── ci.yml
```

That's it. Everything else is added when its phase calls for it.

**Conventions when folders do grow:**

- `apps/` — top-level for deployable apps. Created when the first app (web or api) is added in Phase 1.
  - `apps/web/` — Next.js frontend. Folders inside: `app/`, `components/`, `lib/` — but only create each when there's a real file to put in it.
  - `apps/api/` — FastAPI backend. Folders inside (`adapters/`, `api/`, `core/`, `db/`, `services/`) — same rule: create when there's a real file.

- `packages/` — created the first time something is shared across apps (not before).
  - `packages/shared-types/` — auto-generated TS+Py schemas from OpenAPI (Phase 7).
  - `packages/mcp-servers/` — custom MCP servers (Phase 5).

- `infra/` — config for runtime services. Created when configuring a service requires its own files (Phase 0 for Supabase if needed; later phases add more).

- `docs/` — created when the first ADR or phase doc is written.
  - `docs/adr/` — architecture decision records.
  - `docs/phases/` — per-phase plans and manual test checklists.

- `tests/` — created with the first test. Subfolders (`unit/`, `integration/`, `e2e/`) added when each kind appears.

**Rules for folder depth:**

- A folder must contain at least 3 files (or 2 files + 1 subfolder) to justify existing. Otherwise hoist the file up.
- Max nesting depth: 4 levels from repo root. If you need 5, the structure is wrong.
- Co-locate by feature when reasonable. A feature folder with its component, hook, and test together beats a deep "by-layer" split.

**When adding a new file, ask:**
1. Does an existing folder fit this? → Put it there.
2. Will at least 2 more files join it soon (this phase)? → Create the folder.
3. Otherwise → Put it next to its nearest sibling in an existing folder.

---

## 6. The Phases

Each phase below is a unit of work. Follow Rules 1–10 strictly. Each phase ends with: security review → manual test pass → git tag → push.

**Execution order (added post-Phase 8):** Phases 11–15 (UI redesign + builder bridges) execute before Phases 9 (Voice) and 10 (Localization). Numbering stays append-only so tags don't shift. Within Phases 11–15, the *unit of approval is a page*, not a phase: each page goes design → user confirms → implementation → next page. Git tags still happen at phase boundaries.

**Phase 16 (capstone, added post-Phase 15):** SILA — the conversational platform concierge — runs *after* Phase 9 (Voice) and fuses voice + chat-to-build + platform orchestration into one experience. Build order is text-first, voice-after. It is the last phase. Full execution order: 0–8 ✓ → 11 → 12 → 13 → 14 → 15 → 9 → 10 → 16.

---

### Phase 0 — Foundation & ground rules

**Goal:** Workspace ready. Nothing else can start.

**Already done before Phase 0 (do not redo):** WSL2 + Ubuntu, VS Code connected to WSL, mise, Node 24.15.x, Python 3.13.x, uv, pnpm, Claude Code, and git (configured) are all installed and verified. Phase 0 starts from a ready environment — do not reinstall these. Phase 0 is about the *repository* foundation, not the machine.

**Security review checklist:**
- [ ] `.gitignore` covers `.env`, `node_modules`, `__pycache__`, `*.pem`, model weights, recordings
- [ ] gitleaks pre-commit hook installed
- [ ] No secrets committed (`gitleaks detect`)
- [ ] Branch protection on `main` (require PR + green CI)
- [ ] Dependabot or `pip-audit` / `npm audit` in CI

**Features:**
- [ ] Repo created with the structure in section 5
- [ ] `docker-compose.yml` orchestrates: Supabase, Dify, Ollama, Meilisearch, n8n, Langfuse
- [ ] `Makefile` with: `up`, `down`, `logs`, `restart`, `test`, `lint`, `migrate`, `seed`, `pull-models`, `health`, `clean`
- [ ] `.env.example` lists all required env vars with safe dev defaults
- [ ] pre-commit installed: gitleaks, ruff, biome, conventional-commits
- [ ] GitHub Actions CI: lint, type-check, test, build, dep-audit
- [ ] README with quickstart (< 10 commands to a running stack)
- [ ] Health-check endpoint per service
- [ ] `PHASE_LOG.md` initialized
- [ ] PR template includes phase number, security notes, manual test evidence, complexity notes
- [ ] ADR template added in `docs/adr/0000-template.md`

**OSS tools:** Docker, Docker Compose, GitHub, GitHub Actions, pre-commit, gitleaks, Biome, Ruff, Make, mise

**Plan template before implementing:** N/A — Phase 0 is bootstrapping.

**Manual test checklist:**
- [ ] `git clone` + `make pull-models` + `make up` produces a running stack in < 10 minutes
- [ ] All services pass health check (`make health`)
- [ ] Supabase Studio at `http://localhost:54323`
- [ ] Dify at `http://localhost:3000`
- [ ] Ollama responds at `http://localhost:11434`
- [ ] Langfuse at `http://localhost:3001`
- [ ] Pushing a commit with a secret is BLOCKED by pre-commit
- [ ] Pushing a commit with non-conventional message is BLOCKED
- [ ] CI runs green on a hello-world PR
- [ ] `make down` stops cleanly; data persists across restarts

**Git tag:** `phase-0-complete`

---

### Phase 1 — Authentication, authorization, multi-tenancy

**Goal:** Identity and isolation. Nothing else can be built safely without this.

**Security review checklist:**
- [ ] Password policy: min 12 chars, complexity, breach-check via HIBP API offline (optional for POC)
- [ ] Auth tokens short-lived (≤ 1 hour); refresh tokens rotate
- [ ] All tables have RLS policies enabled
- [ ] OPA policies cover every role × resource × action combination
- [ ] Audit log writes are non-blocking (don't break user request if log fails — but alert)
- [ ] No user-supplied data flows into SQL without parameterization
- [ ] Rate limiting on login + signup endpoints
- [ ] CSRF tokens for state-changing endpoints
- [ ] No PII in error messages or logs
- [ ] Login failures logged but with timing-safe responses (no user enumeration)

**Features:**
- [ ] `AuthService` interface defined; `SupabaseAuthAdapter` implements it
- [ ] Email/password sign-in (POC)
- [ ] Email verification via local MailHog
- [ ] Password reset
- [ ] `workspaces` table (one workspace = one Omantel department, conceptually)
- [ ] Workspace creation flow
- [ ] `memberships` table (user-workspace with role)
- [ ] Roles: Admin, Builder, Reviewer, Hirer, Viewer
- [ ] RBAC middleware enforcing roles at API layer
- [ ] OPA sidecar deployed; policies in `infra/opa/policies/`
- [ ] RLS policies on every tenant table
- [ ] API key generation per workspace (used by Phase 7)
- [ ] Session management with logout + global revoke per user
- [ ] `audit_log` table created (shape: ECS-compatible for future SIEM swap)
- [ ] `record_audit()` helper used by all state-changing endpoints from this phase forward

**Cut for POC (interfaces remain production-ready):**
- ❌ OIDC/SAML — `OmantelSSOAdapter` stub only (interface exists, throws NotImplemented)
- ❌ MFA — endpoint stubs only

**OSS tools:** Supabase Auth (GoTrue), Postgres RLS, OPA, MailHog (dev only)

**Plan template:** before implementing, output:
- Tables to add (`workspaces`, `memberships`, `roles`, `audit_log`, `api_keys`)
- RLS policy text for each table
- OPA policy text for each role × action
- API endpoints with request/response schemas
- Migration files in order
- `AuthService` interface definition
- Time complexity of permission checks (target: O(1) via cached membership lookup)

**Manual test checklist:**
- [ ] Sign up new user → email arrives in MailHog within 5s
- [ ] Click verify link → user activated; cannot log in before activation
- [ ] Log in with correct credentials → JWT issued; expires in 1h
- [ ] Log in with wrong password 5 times → rate-limited (429)
- [ ] Create workspace → user becomes Admin of that workspace
- [ ] Invite user to workspace as Hirer → invited user accesses workspace but not Admin actions
- [ ] User in workspace A cannot read data from workspace B (RLS test via raw SQL)
- [ ] Builder can create draft agent (when Phase 2 exists); Hirer cannot (OPA test)
- [ ] Logout → JWT rejected on next request
- [ ] Global revoke → all sessions for user invalidated
- [ ] Audit log shows every signup, login, workspace creation, role assignment
- [ ] Force-stop Supabase Auth → other endpoints continue working until token expires

**Git tag:** `phase-1-complete`

---

### Phase 2 — Agent lifecycle core

**Goal:** Teammates can import, customize, version, and test agents.

**Security review checklist:**
- [ ] Uploaded YAML files size-limited (< 1 MB)
- [ ] YAML parsed with `yaml.safe_load` only
- [ ] Imported YAML schema validated before storage
- [ ] No code execution from imported YAML (Code nodes processed by Dify sandbox only; static analysis in Phase 6)
- [ ] Agents inherit workspace's default classification (Internal)
- [ ] Dify API key never exposed to frontend
- [ ] Sandbox runs quota-limited per user (default 100 invocations/day)
- [ ] Imported YAML cannot reference tools/MCP servers/KBs the workspace doesn't have

**Features:**
- [ ] Dify deployed and configured
- [ ] `AgentRuntime` interface defined; `DifyAdapter` implements it
- [ ] `agents` table: id, workspace_id, name, description, owner_id, tags, status, version, language, classification, created/updated
- [ ] `agent_versions` table: full snapshot per version
- [ ] `agent_imports` table: audit of every import
- [ ] Import agent from Dify DSL YAML file (upload + parse + validate + register)
- [ ] Import agent from built-in template library (templates in `apps/api/wekala/templates/`)
- [ ] Customize agent: edit prompts, swap model via LiteLLM, adjust parameters, change tool whitelist
- [ ] State machine: Draft → InReview → Published → Archived (transitions audited)
- [ ] Version history with diff view
- [ ] Rollback to previous version (creates new version, not destructive)
- [ ] Sandbox test mode (isolated session, not visible in Bazaar)
- [ ] Clone/fork agent (becomes new draft in same or different workspace)
- [ ] Soft delete + archive (data retained for 90 days then purged by cron)
- [ ] Ownership transfer between workspace members (audit logged)

**OSS tools:** Dify (self-hosted), LiteLLM, Ollama

**Plan template:** before implementing, output:
- Agent state machine diagram (states + allowed transitions + role required for each)
- API endpoints with full schemas
- DB schema with FK relationships
- `AgentRuntime` interface definition (methods: `invoke`, `stream`, `validate_yaml`, `register`, `update`)
- YAML schema validation rules (which fields required, which optional, allowed values)
- Complexity: agent list query O(log n) with index on (workspace_id, status, updated_at)

**Manual test checklist:**
- [ ] Builder uploads a valid Dify YAML → agent appears in Drafts within 2s
- [ ] Builder uploads a malformed YAML → user-friendly error, no crash, no partial state
- [ ] Builder uploads a YAML > 1MB → rejected at upload (413)
- [ ] Builder uploads a YAML referencing a non-existent tool → rejected with clear message naming the missing tool
- [ ] Builder edits draft → version 2 created, version 1 preserved
- [ ] Builder rolls back to version 1 → version 3 created from version 1 content
- [ ] Builder publishes draft (skipping Phase 6 for now, allow directly Draft → Published in this phase) → state changes; audit log written
- [ ] Builder tests agent in sandbox → response returned; not visible to Hirers in same workspace
- [ ] Builder clones a published agent → new draft in same workspace; owner is cloner
- [ ] Viewer cannot create or edit agents (OPA enforcement)
- [ ] Agent created in workspace A is not visible in workspace B (RLS)
- [ ] Archived agent does not appear in lists by default; can be filtered to show
- [ ] Sandbox quota hit → 429 with clear message

**Git tag:** `phase-2-complete`

---

### Phase 3 — Bazaar (marketplace UI)

**Goal:** Users find and hire agents in a polished, professional UI. **English only for v1.** i18n architecture in place from day one (next-intl, translation keys, no hardcoded strings); Arabic translation + RTL is a dedicated post-Phase-9 pass.

**Security review checklist:**
- [ ] All Bazaar queries filtered by workspace (no cross-tenant leakage)
- [ ] User-supplied search input sanitized; passed to Meilisearch via library, not concatenation
- [ ] Rate limiting on search (30 rpm) and hire (10 rpm) endpoints
- [ ] Review content moderated (basic profanity filter for POC; Phase 6 adds full moderation)
- [ ] CSRF on the hire action
- [ ] No PII in agent descriptions surfaced from imports (warning at import time, blocked in Phase 6)
- [ ] All user-supplied strings escaped before render (React default — verify no `dangerouslySetInnerHTML`)

**Features:**
- [ ] Bazaar homepage with sections: Featured, Trending, Newest, My Hired
- [ ] Agent catalog (grid + list views) with pagination (default 20/page, max 100)
- [ ] Search via Meilisearch (index of name + description + tags, English tokenizer for now; multilingual tokenizers added in the localization pass)
- [ ] Filters: category, language, workspace scope, rating, tags, classification
- [ ] Agent detail page: capabilities, sample prompts, ratings, version history, owner
- [ ] Hire flow: one-click → agent appears in "My Agents"
- [ ] "My Hired Agents" view
- [ ] Ratings (1-5) + written reviews
- [ ] Favorites
- [ ] Categories and tags (admin-managed)
- [ ] English UI only for v1
- [ ] All UI strings go through next-intl from day one — no hardcoded user-facing strings anywhere (so Arabic can be added later without code changes)
- [ ] Translation keys organized by feature (e.g. `bazaar.catalog.search.placeholder`)
- [ ] Dark / light mode (system + manual override)
- [ ] Loading skeletons (not spinners) for perceived perf
- [ ] Empty states for every list

**Deferred to post-Phase-9 localization pass (do NOT do now):**
- Arabic translations
- RTL CSS handling (`tailwindcss-rtl`)
- Arabic-tokenizer search
- Arabic fonts

**OSS tools:** Next.js, shadcn/ui, Tailwind CSS, TanStack Query, Meilisearch, next-intl. (Arabic-specific tools — `tailwindcss-rtl`, Tajawal/IBM Plex Sans Arabic — added in the localization pass, not now.)

**Plan template:** before implementing, output:
- Component tree (pages, layouts, shared components — note which are reusable across pages per Rule 7 DRY)
- API endpoints (`GET /bazaar/agents`, `POST /bazaar/agents/{id}/hire`, `POST /bazaar/agents/{id}/reviews`, etc.)
- Meilisearch index schema + ranking rules
- Translation key namespace structure (e.g. `bazaar.catalog.search.placeholder`)
- Cache strategy for Bazaar pages (ISR? client-cache? both?)
- Complexity: catalog query O(log n) with index on (workspace_id OR public, status='Published', sort_key)
- Shared utility/component candidates identified upfront (per Rule 7 DRY)

**Manual test checklist:**
- [ ] Bazaar loads in English by default
- [ ] No hardcoded user-facing strings in source — all go through next-intl (grep test: no string literals in JSX text outside `t('...')` calls)
- [ ] Filter by category → results update; URL reflects state; back button works
- [ ] Pagination works; TanStack Query caches unchanged pages
- [ ] Hire button → agent appears in "My Agents" within 1s
- [ ] Hire from one workspace does not affect another workspace's view
- [ ] Rate an agent → average rating updates with k-anonymity (no rating shown if < 3 raters)
- [ ] Dark mode toggle persists across reload
- [ ] Catalog renders under 200ms with 1000 agents in DB (performance budget)
- [ ] Mobile layout works at 375px width (responsive)
- [ ] Switching the locale stub to a fake "ar" key with one or two test translations renders correctly (proves i18n wiring works end-to-end even though Arabic isn't shipped)

**Git tag:** `phase-3-complete`

---

### Phase 4 — Knowledge Base & RAG

**Goal:** Agents ground responses in workspace documents.

**Security review checklist:**
- [ ] Uploaded files scanned for malware (ClamAV scan service; reject if positive)
- [ ] File size limit per upload (50 MB default)
- [ ] File type allow-list (PDF, DOCX, TXT, MD, HTML only)
- [ ] Documents inherit workspace classification
- [ ] PII detection runs on documents before embedding (flag only in this phase; Phase 6 enforces)
- [ ] Embedding cache invalidates on document version change
- [ ] Vector queries always scoped by workspace_id (RLS + explicit query filter)
- [ ] Citation links cannot leak chunks user shouldn't see
- [ ] Embedding model runs locally only (no remote API calls)

**Features:**
- [ ] Document upload UI (drag-drop + click)
- [ ] Workspace-level KBs (shared) + agent-level KBs (private to one agent)
- [ ] Parsing pipeline (Unstructured.io or Docling) → text + structure
- [ ] OCR fallback for image-only PDFs (Tesseract — English language pack now, Arabic pack added in the localization pass)
- [ ] Chunking: semantic chunks ≤ 1024 tokens with 128-token overlap
- [ ] Embedding generation (BGE-M3, multilingual model — keeps Arabic support free of charge for later)
- [ ] pgvector HNSW index per KB (m=16, ef_construction=64 initial)
- [ ] Hybrid search: vector + Meilisearch full-text + RRF fusion (k=60)
- [ ] Citations in agent responses with source link
- [ ] Document versioning (re-index on update; old version retained 30 days)
- [ ] Per-document ACL within a workspace
- [ ] Background job queue for parsing/embedding (worker container; pg-boss or arq)

**Deferred to localization pass:**
- Arabic OCR language pack
- Arabic preprocessing (CAMeL Tools normalization, dialect handling)

**OSS tools:** pgvector, Unstructured.io or Docling, Apache Tika, BGE-M3, Tesseract (English now; Arabic pack later), ClamAV. CAMeL Tools added in the localization pass.

**Plan template:** before implementing, output:
- Pipeline diagram: upload → virus scan → parse → OCR? → preprocess → chunk → embed → index
- Tables: `kbs`, `kb_documents`, `kb_chunks`, `kb_embeddings`, `kb_jobs`
- HNSW parameters with rationale
- Background job design (queue, worker, retry policy)
- Hybrid search ranking formula
- Complexity: ingestion O(n) over chunks; retrieval O(log n) via HNSW
- Memory budget for embedding worker (target: < 2 GB)

**Manual test checklist:**
- [ ] Upload English PDF (10 pages) → parsed and embedded within 30s
- [ ] Upload scanned PDF (English) → OCR extracts text → embedded
- [ ] Upload corrupt file → user-friendly error
- [ ] Upload 100MB file → rejected at size limit (413)
- [ ] Upload file with malware (EICAR test string) → rejected by ClamAV
- [ ] Query in English returns chunks from English document with citations
- [ ] Citation link opens the source chunk + surrounding context
- [ ] Re-upload same file with edits → embeddings re-generated; old version preserved 30 days
- [ ] User in workspace A cannot query KB in workspace B (RLS)
- [ ] Background queue processes 50 documents without blocking the UI
- [ ] Embedding worker stays under 2 GB RAM

**Git tag:** `phase-4-complete`

---

### Phase 5 — Tools, MCP & integrations

**Goal:** Agents can use tools and external systems safely.

**Security review checklist:**
- [ ] MCP server URLs validated; SSRF blocked (deny private IPs, link-local, cloud metadata addrs)
- [ ] Each MCP server registered with allow-list of workspaces
- [ ] Tool inputs validated against schema before invocation
- [ ] Tool outputs scanned for PII before returning to agent (Phase 6 hook)
- [ ] Tool invocation logged with input/output (truncated if huge; full version in cold storage)
- [ ] HTTP tools' URLs validated; webhook destinations on allow-list per workspace
- [ ] n8n credentials encrypted at rest (use n8n's built-in encryption)
- [ ] Tool execution timeout enforced (default 30s, configurable per tool)

**Features:**
- [ ] Native tool catalog: web fetch, math, current time, code interpreter (sandboxed), file read (KB only)
- [ ] MCP server registration UI (admin only)
- [ ] MCP discovery: list tools exposed by a registered server, with schema
- [ ] Per-agent tool permissions (whitelist enforced at runtime by the broker)
- [ ] n8n workflow as a callable tool type
- [ ] HTTP/webhook tool builder UI
- [ ] Tool invocation logging in audit log
- [ ] Tool input/output schema validation
- [ ] Built-in MCP servers shipped: filesystem-readonly (sandboxed), http-fetch (with allow-list), postgres-readonly (KB queries only)
- [ ] Documentation for the team on building custom MCP servers

**OSS tools:** Anthropic MCP reference servers, MCP Python + TypeScript SDKs, n8n

**Plan template:** before implementing, output:
- MCP integration architecture: how Dify calls MCP servers via the Wekala broker
- Tool registry schema
- Permission enforcement points (registration time, agent-publish time, runtime)
- SSRF prevention strategy (block-list + allow-list + DNS rebinding mitigation)
- Tables: `tools`, `mcp_servers`, `agent_tools`, `tool_invocations`

**Manual test checklist:**
- [ ] Register MCP server pointing to localhost → tools appear in catalog
- [ ] Register MCP server pointing to `http://169.254.169.254` (cloud metadata) → BLOCKED
- [ ] Register MCP server pointing to `http://192.168.1.1` → BLOCKED
- [ ] Agent with `web_fetch` permission can fetch allow-listed URL
- [ ] Agent without `web_fetch` permission denied at runtime
- [ ] Call n8n workflow as tool → workflow executes → result returned
- [ ] Tool invocation appears in audit log with workspace, agent, tool, input hash, outcome
- [ ] Tool with malformed schema → registration rejected
- [ ] Filesystem MCP server cannot escape its sandbox directory (try `../../etc/passwd`)
- [ ] Tool execution exceeding 30s timeout → killed; logged; agent receives timeout error

**Git tag:** `phase-5-complete`

#### MCP authentication (added post-Phase 5)

Real-world MCP servers need auth. Two tiers:

- **Tier 1 — static token / API key (shipped).** Optional bearer token / API key per MCP server, sent as a header (default `Authorization: Bearer <token>`) on every request. Stored **Fernet-encrypted at rest** (`core/security/field_crypto.py`, shared with n8n password storage); never returned to the client (API exposes only `has_auth: bool`). Unlocks Hugging Face and any token/API-key server. Streamable-HTTP transport in `adapters/mcp/http_client.py` (initialize → session → SSE/JSON, with a fallback to the minimal JSON-RPC dialect for built-ins). Migration `0020_mcp_server_auth`.
- **Tier 2 — OAuth 2.1 (planned, future phase).** The full MCP authorization spec for SaaS servers (Sentry, Linear, Notion, GitHub, Atlassian, Stripe…): dynamic client registration + PKCE + browser consent + token refresh + a callback endpoint + consent UI. A dedicated mini-phase — heavier than Tier 1 and not started. **Security:** tokens encrypted at rest, refresh handled server-side, per-workspace isolation, SSRF guard still applies, scopes shown to the user at consent.

---

### Phase 6 — Security Gatekeeper & PDPL ⭐

**Goal:** Nothing reaches the Bazaar without passing safety checks. This is Wekala's differentiator.

**Security review checklist:**
- [ ] Gatekeeper runs in isolated process (no shared state with main app)
- [ ] Gatekeeper failure ≠ silent pass (fail-closed: if scan fails, agent stays in InReview)
- [ ] PII recognizers tuned for Omani context: national ID, mobile prefixes, IBAN, vehicle plates, addresses
- [ ] Red-team prompts cover Arabic + English injection patterns
- [ ] Vetting decisions immutable (audit log + signed with workspace key)
- [ ] Re-vetting required on any agent edit (no "approved once = approved forever")
- [ ] Compliance reports signed and verifiable

**Features:**
- [ ] Vetting pipeline triggered on Draft → InReview transition
- [ ] PII scan on agent system prompts (Presidio + custom Omani recognizers)
- [ ] PII scan on sample inputs (configurable, logged not blocked at this stage)
- [ ] Prompt injection scan on agent prompts (Rebuff + Prompt Guard via Ollama)
- [ ] Data classification labels per agent: Public / Internal / Restricted / Confidential
- [ ] Allowed-tools whitelist per classification level (config in `infra/policies/`)
- [ ] Allowed-data-sources whitelist per classification level
- [ ] Compliance report generated per agent (downloadable PDF, signed)
- [ ] Mandatory Reviewer approval for Restricted+ agents
- [ ] Block-list of forbidden operations per classification
- [ ] Red-team test runner (sample injection corpus run against the agent in sandbox)
- [ ] Synthetic Omani test data fixtures in `tests/fixtures/omani_pii/`
- [ ] Re-vetting on any agent edit (status reverts to Draft)
- [ ] Full audit trail of vetting decisions
- [ ] NeMo Guardrails policies applied at runtime to all Published agents (output safety)

**OSS tools:** Microsoft Presidio (+ custom Omani recognizers), NeMo Guardrails, LlamaGuard / Prompt Guard (via Ollama), Rebuff, Garak

**Plan template:** before implementing, output:
- Vetting state machine (InReview → Scanning → ReadyForReview → Approved/Rejected)
- `AgentScanner` interface + concrete implementations (PII, injection, code, classification-tool-mismatch)
- Classification policy file format (YAML, in repo, version-controlled)
- Synthetic test data design
- Compliance report template (sections, fields, signature scheme)
- Performance budget: full vet under 60s per agent

**Manual test checklist:**
- [ ] Submit agent with national ID "12345678" in prompt → PII detected → flagged
- [ ] Submit agent with prompt-injection pattern "ignore previous instructions" → flagged
- [ ] Submit Public-classified agent requesting access to Restricted KB → rejected at vetting
- [ ] Submit Restricted agent → requires Reviewer approval → Builder cannot self-approve
- [ ] Approve agent → audit log entry signed and immutable
- [ ] Edit approved agent → status reverts to Draft; must re-vet
- [ ] Run red-team corpus (20 prompts) against agent → results logged; failures block publish
- [ ] Generate compliance report → PDF downloads with all scan results, signed
- [ ] Gatekeeper process crashes mid-scan → agent remains InReview (fail-closed)
- [ ] Test corpus of 20 synthetic Omani PII patterns: all detected
- [ ] Full vetting completes in under 60s

**Git tag:** `phase-6-complete`

---

### Phase 7 — Developer SDK & API

**Goal:** External callers (or other teams) can invoke agents programmatically.

**Security review checklist:**
- [ ] API keys hashed in DB (Argon2id; never stored plaintext)
- [ ] API key prefix shown to user always; full key shown once on creation
- [ ] Rate limiting per key (default 60 rpm, configurable)
- [ ] Quotas per key (daily tokens + requests)
- [ ] Streaming endpoint properly closes connections on auth failure
- [ ] CORS allow-list for browser-based SDK usage
- [ ] OpenAPI spec does not leak internal endpoints
- [ ] Webhook payloads signed (HMAC-SHA256) so receivers can verify

**Features:**
- [ ] REST API: `POST /v1/agents/{id}/invoke`, `POST /v1/agents/{id}/stream`
- [ ] Server-Sent Events streaming
- [ ] API key auth header (`X-Wekala-Key`)
- [ ] Sliding-window rate limiting per key
- [ ] Quotas: per-day tokens, per-day requests
- [ ] Webhook subscriptions: `agent.invoked`, `agent.failed`, `agent.completed`
- [ ] Signed webhook payloads (HMAC-SHA256)
- [ ] Python SDK auto-generated from OpenAPI
- [ ] TypeScript SDK auto-generated
- [ ] Docs portal (Docusaurus) with Scalar API reference
- [ ] Code samples (Python, TS, cURL) for every endpoint
- [ ] OpenAPI 3 spec published at `/openapi.json`

**OSS tools:** FastAPI, OpenAPI Generator, Scalar, Docusaurus

**Plan template:** before implementing, output:
- OpenAPI spec (full, draft)
- Versioning strategy (`/v1`, deprecation policy)
- Rate limit algorithm (sliding window via Postgres or Redis)
- Webhook retry policy (exponential backoff, max 5 attempts, dead-letter table)
- SDK package layout (PyPI structure, npm structure)

**Manual test checklist:**
- [ ] Create API key → full key shown once; only prefix later
- [ ] Call `/v1/agents/{id}/invoke` with valid key → response
- [ ] Call with revoked key → 401
- [ ] Exceed rate limit → 429 with `Retry-After` header
- [ ] Stream endpoint sends tokens incrementally; connection survives 5min idle
- [ ] Webhook fires within 5s of agent completion
- [ ] Webhook retried with exponential backoff on receiver failure
- [ ] Webhook signature verifies with shared secret
- [ ] Python SDK installs in fresh venv; quickstart example works
- [ ] TS SDK installs in fresh project; quickstart example works
- [ ] Docs portal builds and serves locally

**Git tag:** `phase-7-complete`

---

### Phase 8 — Command Center & analytics

**Goal:** Executives see ROI, builders see performance, admins see system health. UI built in-house with shadcn blocks.

**Security review checklist:**
- [ ] All dashboard queries scoped by workspace
- [ ] Aggregates do not leak individual user data (k-anonymity ≥ 5 for any breakdown)
- [ ] Export endpoints rate-limited and audit-logged
- [ ] Langfuse data isolated per workspace via project IDs
- [ ] No PII in dashboard data (use IDs, not names, in raw exports)

**Features:**
- [ ] Executive dashboard: KPIs (active agents, total invocations, hours saved, top departments)
- [ ] Hours-saved estimator (config: rules per agent type, in `infra/policies/hours_saved.yaml`)
- [ ] Token cost tracking (per agent, per workspace, per user)
- [ ] Per-agent metrics: invocations, p50/p95/p99 latency, success rate, error rate
- [ ] Per-workspace metrics
- [ ] Top agents leaderboard
- [ ] Audit log viewer with search and filter (date range, actor, action, resource)
- [ ] LLM tracing drill-down (deep-link to Langfuse trace)
- [ ] Anomaly alerts table (stored, surfaced in UI; rules in `infra/policies/anomalies.yaml`)
- [ ] CSV export for any view (audit-logged)
- [ ] Date range filters with sensible presets (today, 7d, 30d, custom)
- [ ] Per-tenant data isolation in all queries

**Data approach:** Application writes events to `audit_log` and `metrics` tables (from Phase 1). Dashboard queries Postgres directly via Supabase. Langfuse runs alongside for LLM-specific traces only. Audit log schema is ECS-compatible so Wazuh/SIEM can ingest later with no migration.

**OSS tools:** shadcn/ui blocks, Recharts, Langfuse, TanStack Table

**Plan template:** before implementing, output:
- Metrics table schema and write paths
- Materialized views or rollup tables for fast dashboard queries (Rule 6)
- Anomaly detection rules (initial: statistical thresholds, e.g. invocations > 3σ of 7-day rolling mean)
- Dashboard component tree
- Query performance budget (every dashboard query < 200ms at 1M rows)

**Manual test checklist:**
- [ ] Dashboard loads under 1s with 100k audit rows
- [ ] Workspace A admin sees only workspace A data
- [ ] Hours-saved KPI matches manual calc on a known dataset
- [ ] Token cost chart aggregates correctly per day
- [ ] Audit log filter by user + action + date range works
- [ ] CSV export of 10k rows downloads under 5s
- [ ] Langfuse drill-down link from "Top agents" opens that agent's traces
- [ ] Anomaly fires when invocations spike 5x daily average

**Git tag:** `phase-8-complete`

---

### Phase 9 — Voice agent support

**Goal:** Platform supports voice modality so teammates can import their voice agent and run it.

**Security review checklist:**
- [ ] Audio sessions authenticated via short-lived tokens (≤ 5 min)
- [ ] Audio recordings encrypted at rest (AES-256)
- [ ] Transcription PII-scanned (Presidio on STT output)
- [ ] LiveKit ICE servers configured to not leak public IPs
- [ ] Recording retention policy enforced (default 30 days; configurable per workspace)
- [ ] Consent prompt before recording starts
- [ ] No raw audio in logs

**Features:**
- [ ] Audio I/O via LiveKit (WebRTC, self-hosted)
- [ ] STT pipeline (faster-whisper — multilingual model, configured for English in v1; locale switch added in localization pass)
- [ ] TTS pipeline (Piper TTS or Coqui XTTS, English voice in v1; voice swap configurable per workspace)
- [ ] Voice activity detection (Silero)
- [ ] Turn-taking + barge-in
- [ ] Voice modality flag on agent metadata (only voice-flagged agents available in voice sessions)
- [ ] Real-time voice session API
- [ ] Voice agent template (forkable by teammates)
- [ ] Telephony hook (placeholder; SIP integration is post-POC)
- [ ] Recording + transcription storage with retention policy
- [ ] Voice metrics in Command Center (call duration, transcription confidence, latency)

**Deferred to localization pass:**
- Arabic/Omani dialect STT tuning
- Omani-voice TTS

**OSS tools:** faster-whisper, Piper TTS or Coqui XTTS, Pipecat, LiveKit, Silero VAD

**Plan template:** before implementing, output:
- Voice session lifecycle (auth → connect → consent → stream → close)
- Pipeline diagram: mic → VAD → STT → agent → TTS → speaker
- Latency budget per stage (target end-to-end < 1.5s)
- Storage schema for recordings + transcripts
- Memory/VRAM budget when voice + LLM run together (target: under 12 GB VRAM)

**Manual test checklist:**
- [ ] Voice session connects within 3s
- [ ] User speaks English → transcribed; agent responds in voice within 1.5s
- [ ] User barges in → previous TTS stops within 300ms
- [ ] Session disconnects cleanly on network drop
- [ ] Recording stored encrypted; only authorized roles can play back
- [ ] Recording auto-deleted after 30 days
- [ ] Consent prompt blocks session until accepted
- [ ] Voice metrics appear in Command Center

**Git tag:** `phase-9-complete`

---

### Phase 10 — Localization pass (Arabic + RTL)

**Goal:** Add full Arabic UI translation and RTL support across the entire platform. This is a single dedicated pass after the platform is functionally complete in English, not a concern threaded through earlier phases.

**Security review checklist:**
- [ ] Translation strings sanitized (no XSS via translation injection)
- [ ] Locale-aware logging does not change audit log structure
- [ ] RTL CSS does not break authorization-sensitive layouts (e.g. confirm buttons stay distinct from cancel)
- [ ] Bidirectional text in user-supplied content (agent names, descriptions) sanitized against RTL-override unicode attacks

**Features:**
- [ ] Arabic translation files for every translation key in the platform
- [ ] RTL CSS via `tailwindcss-rtl` plugin
- [ ] Arabic fonts (Tajawal or IBM Plex Sans Arabic) loaded for `ar` locale
- [ ] Language switcher in user settings (persistent per user)
- [ ] Browser-locale detection on first visit
- [ ] Arabic OCR (Tesseract Arabic pack) in the KB pipeline
- [ ] Arabic preprocessing (CAMeL Tools) for embedding normalization
- [ ] Meilisearch Arabic tokenizer + synonym dictionary
- [ ] Arabic STT model variant in voice pipeline (faster-whisper Arabic config)
- [ ] Omani-dialect TTS voice (fine-tuned Piper or Coqui voice)
- [ ] Date/number/currency formatting per locale
- [ ] Email templates translated

**OSS tools:** `tailwindcss-rtl`, Tajawal/IBM Plex Sans Arabic, CAMeL Tools, Tesseract Arabic pack, Meilisearch Arabic stemmer

**Plan template:** before implementing, output:
- Inventory of every translation key the codebase exposes
- Translation file structure
- RTL audit: list of pages/components that need bidirectional testing
- Locale-specific behaviors documented (date format, number format, currency)
- A separate per-page RTL test checklist

**Manual test checklist:**
- [ ] Every UI page renders correctly in Arabic + RTL
- [ ] All translation keys have non-empty Arabic values
- [ ] Bidirectional text in user-uploaded content displays correctly
- [ ] RTL-override unicode in agent names is escaped / rendered safely
- [ ] Search in Arabic returns expected results
- [ ] Arabic PDF uploaded → OCR works → embedded → queryable
- [ ] Arabic voice session works end-to-end

**Git tag:** `phase-10-complete`

---

### Phase 11 — Design system foundation

**Goal:** Install shadcn/ui as the design system, define light-mode design tokens, build the auth-layout shell, and ship a post-signup onboarding flow. After this phase every new screen is built from shadcn primitives instead of hand-rolled Tailwind.

**Already true before Phase 11:** Phases 0–8 ship working features but use hand-rolled Tailwind throughout. shadcn is NOT installed in `apps/web` yet. The localization architecture (next-intl) is wired and must keep working with shadcn components.

**Security review checklist:**
- [ ] shadcn primitives reviewed: all are client components, zero new runtime deps beyond `@radix-ui/*`, `class-variance-authority`, `tailwind-merge`, `lucide-react`
- [ ] No `dangerouslySetInnerHTML` in any primitive or wrapper
- [ ] Onboarding flow writes to existing JWT-authenticated endpoints only; no new attack surface
- [ ] Skeleton/empty/loading states never leak partial data from other tenants
- [ ] `cn()` helper does not allow class injection via untrusted strings

**Features:**
- [ ] `pnpm dlx shadcn@latest init` in `apps/web` — creates `components.json`, `components/ui/`, `lib/utils.ts`
- [ ] Light-mode-only design tokens in `app/globals.css` (dark-mode CSS variables present but commented or unused per user choice)
- [ ] Wekala brand accent committed (decided per-page on first branded surface)
- [ ] Core primitives installed: Button, Input, Label, Card, Form, Checkbox, Alert, Dialog, Sheet, Avatar, Badge, Skeleton, Separator, Tabs, Tooltip
- [ ] Auth-layout shell (`(auth)/layout.tsx`) updated to a split hero shell that Phase 12 pages slot into
- [ ] Post-signup onboarding wizard — runs once per user, prompts for first workspace + theme intro; gated by a `user_metadata.onboarding_complete` boolean
- [ ] Loading skeletons + empty states standardized across every list page (replaces ad-hoc `animate-pulse` divs)

**Cut for POC:**
- ❌ Dark-mode toggle UI (tokens emitted but the switcher waits for Phase 13's user settings)
- ❌ Theme customization per workspace

**OSS tools:** shadcn/ui, Radix UI primitives, class-variance-authority, tailwind-merge, lucide-react

**Plan template:** before implementing, output the brand-accent choice + the list of primitives to install, and confirm the onboarding-wizard flow.

**Manual test checklist:**
- [ ] `pnpm exec biome check .` passes after shadcn init
- [ ] All previously-built pages still render (Phase 0–8 regressions caught)
- [ ] Onboarding wizard appears on first login after a fresh signup; never appears again after the user dismisses it
- [ ] `cn("foo", false && "bar", "baz")` returns `"foo baz"` (utility verified)

**Git tag:** `phase-11-complete`

---

### Phase 12 — Auth flow redesign (page-by-page)

**Goal:** Replace hand-rolled Tailwind auth forms with shadcn-based, accessible, branded versions. Sign-up gains a name field, a strength meter, and a confirm-password field.

**Pages, in order:**
1. **Sign-up** — name, email, password, confirm password, terms checkbox
2. **Sign-in** — email, password, "remember me", forgot-password link
3. **Verify email** — friendlier illustration, clearer "check your email" CTA, paste-OTP behavior
4. **Reset password** — request link + set-new-password completion

**Security review checklist:**
- [ ] Sign-up `full_name` sanitized server-side (length 2–60, no control chars)
- [ ] Confirm-password validated client-side AND server-side
- [ ] Password strength meter is purely informational; server enforces the 12-char min
- [ ] "Remember me" only swaps sessionStorage for localStorage on this device; server still issues short-lived JWT
- [ ] Sign-in still returns generic "Invalid credentials" (no enumeration)
- [ ] Verify-email rate-limited per email per hour (prevents brute force on OTP)
- [ ] Password-reset link is a Supabase-issued single-use token; never echo it in URLs visible in browser history beyond the immediate redirect

**Features:**
- [ ] `POST /v1/auth/signup` accepts optional `full_name`; stored in Supabase `user_metadata.full_name`
- [ ] All four pages share the Phase 11 split-hero shell
- [ ] Each form uses shadcn `Form` + `react-hook-form` + `zod` for validation
- [ ] Show/hide password toggle on every password field (accessible — `aria-pressed`)
- [ ] Inline per-field error messages via `FormMessage`
- [ ] Top-of-form `Alert` (destructive) for server errors
- [ ] All translation keys go through next-intl (no hardcoded strings)

**OSS tools:** shadcn/ui Form, react-hook-form, zod, lucide-react

**Plan template:** before implementing each page, output an ASCII layout sketch + field list + validation rules + component inventory + acceptance criteria, then wait for user confirmation.

**Manual test checklist (per page):**
- [ ] Visual matches the confirmed design
- [ ] Happy path: sign-up new user → verify → sign-in succeeds → land on dashboard
- [ ] Password < 12 chars → inline error, submit disabled
- [ ] Confirm-password mismatch → inline error, submit disabled
- [ ] Wrong sign-in credentials → generic "Invalid credentials"
- [ ] Keyboard-only flow works end-to-end (tab order, focus rings, enter to submit)
- [ ] Screen-reader labels correct (Lighthouse a11y > 95)
- [ ] Reset-password email arrives in MailHog within 5s

**Git tag:** `phase-12-complete`

---

### Phase 13 — App shell + dashboard

**Goal:** A polished, navigable shell — collapsible double-sidebar, branded header, dashboard hero with recent activity, and a refreshed workspace home + settings.

**Pages, in order:**
1. **App layout** — sidebar (workspace switcher + section nav, both collapsible) + header (workspace breadcrumb, user menu)
2. **Dashboard** — hero "welcome back" + quick actions + recent activity (from `audit_log`) + KPI snapshot
3. **Workspace home** — replace the current stat-cards page with a richer dashboard scoped to one workspace
4. **Workspace settings** — converted to tabs (General / Members / Developer / Danger zone)

**Security review checklist:**
- [ ] Workspace switcher only lists workspaces the user is a member of (RLS verified)
- [ ] Recent activity is scoped to the workspace; cross-tenant rows never leak
- [ ] User menu's "Sign out" call to clear sessionStorage is irrevocable from server-side too (existing /auth/logout)
- [ ] Settings tabs respect role (Members + Danger zone admin-only; Developer admin-only)

**Features:**
- [ ] Collapsible double-sidebar with persisted state in localStorage
- [ ] Workspace switcher dropdown (avatar + name)
- [ ] Breadcrumb in header reflects current page
- [ ] Dashboard recent-activity reads from `audit_log` (last 20 events)
- [ ] Quick actions: New Agent, Browse Bazaar, Open Command Center
- [ ] Workspace settings split into Tabs (General / Members / Developer / Danger zone) using shadcn `Tabs`

**OSS tools:** shadcn/ui Tabs, Sheet, Avatar, DropdownMenu

**Manual test checklist (per page):**
- [ ] Sidebar collapses + expands; state persists across reload
- [ ] Active route highlights
- [ ] Workspace switcher navigates correctly
- [ ] Recent activity matches `SELECT … FROM audit_log WHERE actor_workspace_id=… ORDER BY timestamp DESC LIMIT 20`
- [ ] Settings tabs hide admin-only tabs for non-admin viewers (verified with a viewer-role user)

**Git tag:** `phase-13-complete`

---

### Phase 14 — Agent flow redesign

**Goal:** A polished agent list, a tabbed agent detail page, and a New-Agent flow that offers four paths: Template / Upload YAML / Chat-to-build / Build in Dify.

**Pages, in order:**
1. **Agents list** — table or grid with filters (status, classification, vetting), search, sort
2. **Agent detail** — header with status + vetting + classification badges; tabs: Overview / Versions / Vetting / Tools / Test
3. **New Agent** — 4 tabs: From Template / Upload YAML / Chat-to-build / Build in Dify
4. **Test playground** — streaming test runs (replaces the current one-shot test panel)

**Security review checklist:**
- [ ] Test playground enforces the existing sandbox quota (Phase 2; 100/day per user)
- [ ] Chat-to-build wizard calls the LLM gateway with the workspace's classification context; never lets the agent it's building "decide" its own classification
- [ ] Generated YAML from chat-to-build is treated as untrusted user input — must still pass Phase 6 vetting before publish
- [ ] Test-streaming SSE endpoint closes connections on auth expiry
- [ ] Per-agent tools whitelist still enforced at invocation time (Phase 5)

**Features:**
- [ ] Agents list: filter + search + sort; pagination (default 20)
- [ ] Agent detail tabs (5 tabs, each backed by an existing endpoint)
- [ ] New Agent — 4-tab modal/page; Template + Upload tabs already exist (just restyled), Chat-to-build + Build-in-Dify are new
- [ ] Test playground with SSE token streaming (new endpoint `POST /v1/workspaces/{wid}/agents/{aid}/test-stream`)
- [ ] Chat-to-build wizard: user chats with Claude/Ollama, system asks "What should this agent do?", "Tools?", "Classification?", generates a Dify YAML, presents for confirm + import

**Backend changes:**
- New SSE endpoint for streaming test responses
- New endpoint for chat-to-build wizard: stateful conversation → YAML generation → returns YAML for review

**OSS tools:** shadcn/ui Tabs, DataTable, Command (cmdk), Dialog

**Manual test checklist (per page):**
- [ ] Agents list filters update URL, browser-back works
- [ ] Each agent-detail tab loads and shows correct data
- [ ] Test playground streams tokens incrementally (not one-shot)
- [ ] Chat-to-build produces a Dify YAML that imports cleanly into the same workspace
- [ ] Chat-to-build agent is created as Draft + Unvetted (must pass gatekeeper before publish)

**Git tag:** `phase-14-complete`

---

### Phase 15 — Builder bridges + comprehensiveness

**Goal:** Make Dify, n8n, Langfuse, and agent-reporting feel like first-class parts of Wekala. Stop sending teammates to four browser tabs.

**Surfaces, in order:**
1. **"Build in Dify" deep-link** — opens Dify in a new tab, with a return-callback that polls Dify for the new app's YAML and imports it
2. **Workflows sidebar item** — deep-links to n8n + lists Wekala-registered n8n workflows-as-tools
3. **Langfuse trace deep-link** — from any audit-log row or invocation row that has a trace_id
4. **Agent reports** — `POST /v1/bazaar/agents/{id}/reports`; new `agent_reports` table with RLS; admin review queue
5. **Tool playground** — Workspace → Tools → click any granted tool → form-generated input → run

**Security review checklist:**
- [ ] All deep-links use trusted hostnames (the existing Docker-network service names); no user-supplied URLs
- [ ] Agent-report submission rate-limited per user per agent (5/day) to prevent harassment
- [ ] Reports visible only to the agent-owning workspace admins + Wekala admins; never to other Bazaar users
- [ ] Report content sanitized (no HTML, length-capped 2KB)
- [ ] Tool playground respects per-agent whitelist (Phase 5 enforcement)
- [ ] Tool playground's form-generated inputs validated against the tool's JSON Schema before invocation

**Features:**
- [ ] "Build in Dify" button on New Agent page → opens Dify, prompts user to click "Done" → polls Dify and auto-imports
- [ ] Workflows sidebar item with two sections: registered n8n workflows + "Open n8n studio" link
- [ ] Langfuse deep-link appears next to invocations and audit rows when a trace_id is present
- [ ] Agent reports table + endpoint + UI ("Report this agent" button on Bazaar agent page)
- [ ] Admin review queue at `/workspaces/{wid}/reports` for the workspace owning the reported agent
- [ ] Tool playground page wired to the existing `POST .../tools/{tid}/invoke` endpoint

**Backend changes:**
- New table `agent_reports` (Phase 15 migration)
- New endpoints `POST /v1/bazaar/agents/{id}/reports`, `GET /v1/workspaces/{wid}/reports`, `POST /v1/workspaces/{wid}/reports/{rid}/resolve`
- New audit actions: `agent.report`, `report.resolve`

**OSS tools:** shadcn/ui Sheet, DataTable, Form

**Manual test checklist (per surface):**
- [ ] "Build in Dify" round-trip: open Dify → make a trivial change → return to Wekala → agent appears as a new Draft
- [ ] Workflows page lists registered n8n workflows; "Open n8n" opens n8n in a new tab
- [ ] Langfuse trace deep-link opens the right trace
- [ ] Report submission rate-limited at 5/day per user per agent
- [ ] Tool playground refuses to invoke a tool the agent isn't granted

**Git tag:** `phase-15-complete`

---

### Phase 16 — SILA: Conversational Platform Concierge ⭐

**Goal:** Let non-experts build agents and operate the platform by *talking* (or typing) to a concierge — **SILA** (صلة, "connection / link" — your link to the platform). It asks clarifying questions, opens modals mid-session (e.g. for a data upload) without ending the conversation, builds Dify agents *and* n8n workflows on the user's behalf, and drives the platform UI — all strictly within the user's role. The capstone that fuses Phase 9 (Voice), Phase 14 (chat-to-build), and a function-calling orchestration brain.

**Execution:** Capstone — runs after Phases 11–15, after Phase 9 (voice infra), and after KB document processing is moved to a dedicated worker container (the in-process pipeline twice took the API down; a concierge firing many operations would amplify that). Build order: **text-first, voice-after.**

**Security review checklist:**
- [ ] Concierge acts only via the user's JWT — every tool call passes through the existing `require_workspace_role` + OPA; worst case is 403, never privilege escalation
- [ ] Builder-scope tool registry only: NO delete, NO member/role change, NO publish/approve
- [ ] Generated agents are always Draft + Unvetted — must pass the Phase 6 gatekeeper before publish; the concierge cannot self-approve
- [ ] External-effect actions (n8n social/email nodes) require explicit user confirmation + classification gating; cloud-LLM nodes stay excluded (sovereignty / PDPL)
- [ ] Concierge cannot set an agent's classification itself (inherits workspace default)
- [ ] Every concierge action is audit-logged with an "actor = concierge on behalf of <user>" marker
- [ ] Conversation/session tables are RLS-scoped per workspace
- [ ] WebSocket auth: the concierge socket verifies the same JWT and closes on token expiry
- [ ] Voice (16E): consent before recording; recordings encrypted + retention per Phase 9; no raw audio in logs

**Features (5 stages):**
- [ ] **16A — LLM gateway upgrade:** add token streaming + native Ollama tool/function-calling to the `LLMGateway` Protocol + `OllamaLLMAdapter` (keep `complete_json` for the gatekeeper). Tune the orchestration model (qwen2.5:7b → 14b) within the 12 GB VRAM budget.
- [ ] **16B — Concierge brain:** `ConciergeService` function-calling loop; a *curated* tool registry where each tool wraps an existing service call (so OPA still enforces); conversation-state tables; a WebSocket channel carrying user text, streamed assistant tokens, tool-call status, and UI commands (`open_modal` / `navigate` / `highlight` / `await_input`)
- [ ] **16C — Generators:** spec → Dify YAML (Draft + Unvetted; reuse `validate_yaml` + `AgentService.import_from_yaml`); spec → n8n workflow (extend `N8nService` with `create_workflow`, local/allow-listed nodes only)
- [ ] **16D — Orb widget:** persistent floating concierge orb (Listening / Thinking / Speaking) mounted in the `(app)` shell; WS client; renders mid-session modals; an activity trail of tool calls; confirmation prompts for external/irreversible actions
- [ ] **16E — Voice:** the Phase 9 stack (LiveKit, faster-whisper, Piper/Coqui, Silero VAD, Pipecat) feeds transcribed text into the *same* 16B brain and speaks responses; optional "SILA/JARVIS" wake word; the orb reacts to state

**Cut for v1 (interfaces stay production-ready):**
- ❌ Destructive/admin ops (delete, member/role changes) and publish/approve — vetting stays a human decision
- ❌ Arabic voice — deferred to the Phase 10 localization pass
- ❌ Fully autonomous execution of external actions without confirmation

**OSS tools:** Ollama (tool-calling model), FastAPI WebSockets, LiveKit, faster-whisper, Piper/Coqui TTS, Silero VAD, Pipecat

**Plan template:** before implementing each stage, output the tool-registry schema (per tool: name, JSON schema, which existing service it wraps, role required), the conversation-state tables + migration, the WebSocket message protocol, and the safety/confirmation flow.

**Manual test checklist:**
- [ ] Text: "build an agent that answers HR questions from my handbook" → concierge asks clarifying Qs → opens an upload modal mid-session → user uploads → drafts the agent (Draft + Unvetted) → it appears in Agents → it is blocked from publish until it passes the gatekeeper
- [ ] Text: the morning AI-trends → social-post-with-media → email example → created as an n8n workflow draft (local LLM node; external publish/email nodes confirmed)
- [ ] Safety: concierge attempts a delete / a publish / a cross-workspace action → blocked (not in registry / 403 / stays Draft)
- [ ] The orb opens modals mid-session without ending the conversation; the WebSocket reconnects after a drop
- [ ] Voice round-trip (speak → transcribe → brain → speak), barge-in, consent prompt, orb state transitions

**Git tag:** `phase-16-complete`

---

## 7. Cross-cutting concerns (every phase touches these)

**audit_log table** — every state change writes a row:
- `id, timestamp, actor_user_id, actor_workspace_id, action, resource_type, resource_id, outcome, metadata jsonb, trace_id`
- ECS-compatible field names so SIEM ingest is later straightforward

**metrics table** — every measurable event:
- `id, timestamp, workspace_id, agent_id?, user_id?, metric_name, value, tags jsonb`

**OpenTelemetry instrumentation** — FastAPI middleware + Next.js custom logger emit traces and metrics. No external collector required for POC.

**Migrations** — Alembic for Python schema, versioned and reversible. Always test up + down on a fresh DB before merging.

**Every PR runs in CI:** gitleaks, ruff, biome, type-check (mypy/tsc), unit tests, integration tests, optional Garak smoke test (Phase 6+).

**Every phase ends with:** security review → manual test pass → git tag → push → entry in `PHASE_LOG.md`.

---

## 8. Conventions

**Directory naming:** kebab-case (`agent-runtime/`)

**File naming:**
- Python: snake_case (`agent_runtime.py`)
- TS/TSX modules: kebab-case (`agent-runtime.ts`)
- React components: PascalCase (`AgentCard.tsx`)

**Branch naming:** `phase-N/<short-description>` for phase work; `fix/<short>` and `refactor/<short>` for hotfixes

**PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) requires:
- Phase number
- Summary
- Security review notes
- Manual test pass evidence
- Algorithmic complexity notes
- Breaking changes (if any)

**Architecture Decision Records:** every non-trivial decision becomes an ADR in `docs/adr/`. Format: `ADR-NNNN-short-title.md` with Context, Decision, Consequences, Alternatives considered.

---

## 9. Threat model (brief)

**Assets to protect:**
1. Workspace data (documents, prompts, embeddings) — confidentiality
2. Audit log — integrity
3. Agent definitions — integrity
4. API keys — confidentiality
5. User identities — confidentiality + integrity
6. Audio recordings (Phase 9) — confidentiality

**Adversaries (decreasing privilege):**
- External attacker (no creds)
- Malicious authenticated user in own workspace
- Curious user trying to access another workspace
- Compromised agent (prompt-injected to misuse tools)
- Insider with admin role

**Key controls** are in each phase's security review section. Refer back when planning a phase.

---

## 10. When in doubt

Default behaviors when uncertain:
- **Cut features, not quality.** Better Phase 3 with 5 polished pages than 10 broken.
- **Cut features, not security.** Never disable a security control to "ship faster."
- **Cut features, not the swappable-adapter rule.** Production-readiness is non-negotiable.
- **Ask Mojahid** if a decision is hard to reverse.
- **Tag a checkpoint** before any risky operation.
- **Read this file again** if anything seems unclear.

---

## 11. Phase log

Maintained in `PHASE_LOG.md`. Format:

```
## Phase N — <name>
- Started: YYYY-MM-DD
- Completed: YYYY-MM-DD
- Tag: phase-N-complete
- Notes: <key decisions, gotchas>
- Outstanding: <known issues deferred>
- ADRs added: <ADR-NNNN, ADR-MMMM>
```

---

End of CLAUDE.md.
