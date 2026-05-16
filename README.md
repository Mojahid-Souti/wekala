# Wekala Platform

> Sovereign AI agent marketplace and factory. Teams discover, customize, and hire pre-vetted AI agents. All data stays on local infrastructure. PDPL-compliant.

---

## Quickstart

You need: **Docker**, **Docker Compose v2**, **make**, **git**, **Python 3.13**, **Node 24**, **pnpm**, **uv** — all pre-installed in WSL2 per the dev environment guide.

```bash
# 1. Clone
git clone <repo-url> && cd GenZ_Project_Wekala

# 2. Copy .env and generate secrets
make setup
make keygen          # generates JWT keys + random secrets into .env

# 3. Pull Ollama models (downloads ~10 GB — do this once)
make up              # start the stack first so Ollama container is ready
make pull-models

# 4. Verify everything is healthy
make health
```

That's it. The full stack is running.

---

## Service URLs

| Service | URL | Notes |
|---|---|---|
| Supabase Studio | http://localhost:54323 | DB admin + auth |
| Supabase API | http://localhost:8000 | Kong gateway |
| Dify | http://localhost:3000 | Agent runtime UI |
| Langfuse | http://localhost:3001 | LLM observability |
| Ollama | http://localhost:11434 | LLM serving |
| Meilisearch | http://localhost:7700 | Search engine |
| n8n | http://localhost:5678 | Workflow automation |
| MailHog | http://localhost:8025 | Dev SMTP inbox |

---

## Daily workflow

```bash
make up              # start stack
make logs            # tail all logs
make logs-svc SVC=dify-api   # tail one service
make down            # stop stack (data persists)
make health          # check all service health
```

---

## Common tasks

```bash
make lint            # run ruff + biome
make test            # run pytest + vitest
make migrate         # run Alembic migrations (Phase 1+)
make seed            # seed DB with dev data (Phase 1+)
make secret-scan     # gitleaks scan of working tree
make clean           # DESTRUCTIVE — wipe all volumes (asks for confirmation)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Wekala Web (Next.js)        Wekala API (FastAPI)        │  Phase 1+
├─────────────────────────────────────────────────────────┤
│  Supabase (Postgres + Auth + Storage + Realtime)        │
│  Dify (agent runtime)    Ollama (LLM)                   │
│  Meilisearch (search)    n8n (connectors)               │
│  Langfuse (observability)  MailHog (dev SMTP)           │
└─────────────────────────────────────────────────────────┘
```

All components talk over isolated Docker networks. External traffic enters through Supabase Kong on port 8000.

---

## Environment variables

Copy `.env.example` to `.env` before starting. Generate secrets:

```bash
make setup    # copies .env.example → .env
make keygen   # fills in generated secrets (JWT keys, random passwords)
```

Key variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_JWT_SECRET` | Signs Supabase auth tokens |
| `SUPABASE_ANON_KEY` | Public Supabase API key (generated from JWT secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-level key (never expose to browser) |
| `DIFY_SECRET_KEY` | Dify application secret |
| `MEILI_MASTER_KEY` | Meilisearch master API key |
| `N8N_ENCRYPTION_KEY` | Encrypts n8n credentials at rest |
| `LANGFUSE_SECRET_KEY` | Langfuse SDK secret key |

---

## Default AI models

| Role | Model | Notes |
|---|---|---|
| LLM | `qwen2.5:7b-instruct` | Strong multilingual, fits 12 GB VRAM |
| Embeddings | `bge-m3` | Multilingual, supports Arabic from day one |
| Reranker | `bge-reranker-v2-m3` | Used from Phase 4 (RAG) |

Change via `OLLAMA_DEFAULT_LLM` / `OLLAMA_EMBEDDING_MODEL` in `.env`.

---

## Branch protection (one-time GitHub setup)

After pushing, go to **Settings → Branches → Add rule** for `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass (select the CI workflow)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

---

## Development guide

See [CLAUDE.md](CLAUDE.md) for the full development guide: working rules, phase plan, algorithmic standards, and commit conventions.

---

## Phase progress

See [PHASE_LOG.md](PHASE_LOG.md).
