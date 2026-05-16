# Phase Log

Record of completed phases. Updated after each phase passes manual test and is tagged.

Format:

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

## Phase 0 — Foundation & Ground Rules

- Started: 2026-05-16
- Completed: pending manual test sign-off
- Tag: pending
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
- Outstanding:
  - Branch protection on `main` on GitHub must be configured manually after remote is created (see README).
  - Dependabot config not yet in place — no `apps/` with package manifests; add in Phase 1.
  - `LANGFUSE_PUBLIC_KEY` requires one manual step: log into Langfuse → create org + project → copy public API key into `.env`.
- ADRs added: —
