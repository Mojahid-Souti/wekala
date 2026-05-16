# Manual Test Checklist — Phase 0: Foundation

Run these tests after a fresh clone to verify the full Phase 0 foundation works end-to-end.

## Prerequisites

- WSL2 + Ubuntu, Docker running, `make` installed
- Node.js 24+ available (`node --version`)
- `pre-commit` installed (`pip install pre-commit`)
- No existing `.env` in the repo root

---

## Scenario 1 — First-time setup and stack startup

**Steps:**
1. `git clone <repo-url>` into a fresh directory
2. `cd GenZ_Project_Wekala`
3. `make setup` — should create `.env` from `.env.example`
4. `make keygen` — should generate secrets into `.env`
5. `make pull-images` — pulls all Docker images (one at a time; takes a while on first run)
6. `make up` — starts the full stack

**Expected outcome:**
- `make setup` prints `✓ Created .env from .env.example`
- `make keygen` prints a list of generated keys (SUPABASE_JWT_SECRET, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DIFY_SECRET_KEY, DIFY_SANDBOX_API_KEY, WEKALA_SECRET_KEY, MEILI_MASTER_KEY, N8N_ENCRYPTION_KEY, N8N_USER_MANAGEMENT_JWT_SECRET, LANGFUSE_SECRET_KEY, LANGFUSE_NEXTAUTH_SECRET, LANGFUSE_SALT, CLICKHOUSE_PASSWORD, WEKALA_SUPABASE_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- `.env` contains no `CHANGE_ME` prefixes in the auto-generated keys
- `make up` exits cleanly; all containers start

**Evidence:** `docker compose ps` shows all containers `Up` with no exits

- [ ] PASS / FAIL

---

## Scenario 2 — All services pass health check

**Steps:**
1. Wait ~60s after `make up` for services to initialize
2. `make health`

**Expected outcome:**
```
Service health checks:
  ✓ Supabase DB          HTTP 200
  ✓ Supabase Studio      HTTP 307
  ✓ Dify Web             HTTP 307
  ✓ Langfuse             HTTP 200
  ✓ Ollama               HTTP 200
  ✓ Meilisearch          HTTP 200
  ✓ n8n                  HTTP 200
  ✓ MailHog              HTTP 200
```

All 8 lines show `✓`. No `✗`. Health check completes in under 30s total.

**Evidence:** Terminal output

- [ ] PASS / FAIL

---

## Scenario 3 — Service UIs are reachable in browser

**Steps:**
1. Open each URL in a browser (inside WSL or via Windows browser with WSL2 port forwarding):

| Service | URL |
|---|---|
| Supabase Studio | http://localhost:54323 |
| Dify | http://localhost:3000 |
| Langfuse | http://localhost:3001 |
| Ollama API | http://localhost:11434 |
| Meilisearch | http://localhost:7700 |
| n8n | http://localhost:5678 |
| MailHog | http://localhost:8025 |
| Supabase API | http://localhost:8000 |

**Expected outcome:**
- Studio → redirects to login page or project page
- Dify → redirects to setup or login page
- Langfuse → login page
- Ollama → JSON response `{"models": [...]}`
- Meilisearch → JSON `{"status": "available"}`
- n8n → login page
- MailHog → inbox UI
- Supabase API → 401 (correct — requires apikey header)

**Evidence:** Browser screenshots or URL bar confirmation

- [ ] PASS / FAIL

---

## Scenario 4 — Kong JWT auth works via API

**Steps:**
```bash
ANON_KEY=$(grep ^SUPABASE_ANON_KEY .env | cut -d= -f2-)
curl -s http://localhost:8000/rest/v1/ -H "apikey: $ANON_KEY" -o /dev/null -w "HTTP %{http_code}\n"
```

**Expected outcome:** `HTTP 200`

**Evidence:** Terminal output

- [ ] PASS / FAIL

---

## Scenario 5 — Pre-commit blocks a commit containing a secret

**Steps:**
1. `make install-hooks` (or `pre-commit install --hook-type commit-msg --hook-type pre-commit`)
2. Add a fake secret to any file:
   ```bash
   echo "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" >> /tmp/test-secret.txt
   cp /tmp/test-secret.txt test-secret.txt
   git add test-secret.txt
   git commit -m "test: adding secret"
   ```

**Expected outcome:**
- `Detect hardcoded secrets` hook FAILS
- Commit is BLOCKED
- `test-secret.txt` is NOT committed

**Cleanup:**
```bash
git restore --staged test-secret.txt
rm test-secret.txt
```

**Evidence:** Pre-commit output showing failure for `Detect hardcoded secrets`

- [ ] PASS / FAIL

---

## Scenario 6 — Pre-commit blocks a non-conventional commit message

**Steps:**
1. Make a trivial change (e.g., add a blank line to README.md)
2. `git add README.md`
3. `git commit -m "updated the readme"`  (not conventional format)

**Expected outcome:**
- `Conventional Commit` hook FAILS
- Commit is BLOCKED with a message about conventional commit format

**Cleanup:** `git restore --staged README.md`

**Evidence:** Pre-commit output showing `Conventional Commit` failure

- [ ] PASS / FAIL

---

## Scenario 7 — make keygen is idempotent

**Steps:**
1. Run `make keygen` a second time (after secrets are already set)

**Expected outcome:**
- Output: `All managed keys already have real values — nothing to generate.`
- `.env` is NOT modified (values unchanged)

**Evidence:** `git diff .env` shows no changes after second run

- [ ] PASS / FAIL

---

## Scenario 8 — Stack persists data across restart

**Steps:**
1. Log into Langfuse at http://localhost:3001 and create a user account
2. `make down`
3. `make up`
4. Wait ~60s, then log into Langfuse at http://localhost:3001

**Expected outcome:**
- User account created in step 1 still exists after restart
- No re-initialization required

**Evidence:** Successful login after restart

- [ ] PASS / FAIL

---

## Scenario 9 — make down stops cleanly

**Steps:**
1. `make down`

**Expected outcome:**
- All containers stop cleanly within 30s
- `docker compose ps` shows no running containers
- No errors in output

**Evidence:** Terminal output

- [ ] PASS / FAIL

---

## Scenario 10 — gitleaks secret scan passes on the repo

**Steps:**
```bash
gitleaks detect --source . --verbose
```

**Expected outcome:**
- `No leaks found` (or zero findings)
- `.env` is in `.gitignore` and not scanned

**Evidence:** gitleaks output

- [ ] PASS / FAIL

---

## Summary

| # | Scenario | Result |
|---|---|---|
| 1 | First-time setup and stack startup | ⬜ |
| 2 | All services pass health check | ⬜ |
| 3 | Service UIs reachable in browser | ⬜ |
| 4 | Kong JWT auth works via API | ⬜ |
| 5 | Pre-commit blocks secret commit | ⬜ |
| 6 | Pre-commit blocks non-conventional message | ⬜ |
| 7 | keygen is idempotent | ⬜ |
| 8 | Data persists across restart | ⬜ |
| 9 | make down stops cleanly | ⬜ |
| 10 | gitleaks scan passes | ⬜ |

**Phase 0 is complete when all 10 scenarios pass.**

After all pass: `git tag -a phase-0-complete -m "Phase 0: Foundation complete"` then `git push origin phase-0-complete`.

---

## Known manual steps after stack starts (not tested here)

- **LANGFUSE_PUBLIC_KEY**: After Langfuse first login, create an org + project, copy the public API key into `.env` as `LANGFUSE_PUBLIC_KEY`.
- **GitHub branch protection**: Enable "Require PR + green CI" on `main` after pushing to GitHub.
- **Ollama models**: Run `make pull-models` to download the default LLM + embedding + reranker models (large download, do once).
