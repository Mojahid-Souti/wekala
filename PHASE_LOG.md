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
- Completed: —
- Tag: —
- Notes:
  - Dev environment pre-existing (WSL2, Node 24.15, Python 3.13, mise, uv, pnpm, git).
  - Phase 0 scope: repo skeleton only — no app code.
  - `infra/supabase/kong.yml` added (section 5 explicitly allows `infra/` in Phase 0 when a service needs config files).
  - Supabase Anon + Service Role JWTs generated via `make keygen` (not committed); placeholder in `.env.example`.
  - Dify at port 3000; Wekala Web will be port 3002 (Phase 1) to avoid collision.
  - `docker-compose.yml` exceeds 400 lines — acceptable for a declarative config file (Rule 7 targets code files).
  - Ollama GPU passthrough enabled via NVIDIA runtime; comment out if no GPU available.
  - All secrets use `CHANGE_ME_*` placeholders in `.env.example` to avoid gitleaks false positives.
- Outstanding:
  - Branch protection on GitHub must be configured manually (see README).
  - `make keygen` script (`scripts/keygen.py`) to be written when Phase 1 adds `apps/`.
    For now, generate manually: `openssl rand -hex 32` for secrets, Supabase JWT via their docs.
  - Dependabot config not yet in place (no `apps/` with package manifests).
- ADRs added: —
