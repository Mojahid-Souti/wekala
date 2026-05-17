#!/usr/bin/env bash
# scripts/test-phase-0.sh — Phase 0 automated test suite
#
# Tests infrastructure only (no app code). Requires the full stack to be
# running (`make up`) before executing.
#
# Exit 0 = all tests pass.  Exit 1 = one or more failures.
# Usage:  bash scripts/test-phase-0.sh   OR   make test-phase-0

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
BOLD=$'\033[1m'; RESET=$'\033[0m'; GREEN=$'\033[32m'; RED=$'\033[31m'; CYAN=$'\033[36m'
PASS=0; FAIL=0

ok()     { PASS=$((PASS+1)); printf "  ${GREEN}✓${RESET}  %s\n" "$1"; }
fail()   { FAIL=$((FAIL+1)); printf "  ${RED}✗${RESET}  %s\n" "$1"; }
header() { echo; echo "${BOLD}$1${RESET}"; }

# ---------------------------------------------------------------------------
# Helper: HTTP status for a URL (with optional header, 5s timeout)
# ---------------------------------------------------------------------------
http_status() {
  local url="$1"; local hdr="${2-}"
  if [ -n "$hdr" ]; then
    curl -s --connect-timeout 5 --max-time 10 -o /dev/null -w "%{http_code}" \
      -H "$hdr" "$url" 2>/dev/null
  else
    curl -s --connect-timeout 5 --max-time 10 -o /dev/null -w "%{http_code}" \
      "$url" 2>/dev/null
  fi
}

# ---------------------------------------------------------------------------
# 1. Repository structure
# ---------------------------------------------------------------------------
header "1. Repository structure"

required_files=(
  ".gitignore"
  ".env.example"
  "README.md"
  "PHASE_LOG.md"
  "docker-compose.yml"
  "Makefile"
  ".pre-commit-config.yaml"
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/workflows/ci.yml"
  "scripts/keygen.js"
  "infra/supabase/kong.yml"
  "infra/supabase/volumes/db/roles.sql"
  "infra/supabase/volumes/db/jwt.sql"
  "infra/supabase/volumes/db/realtime.sql"
  "infra/supabase/volumes/db/webhooks.sql"
  "docs/adr/0000-template.md"
  "docs/phases/MANUAL_TEST_PHASE_0.md"
)
for f in "${required_files[@]}"; do
  if [ -f "$f" ]; then ok "$f exists"; else fail "$f MISSING"; fi
done

# ---------------------------------------------------------------------------
# 2. .gitignore coverage
# ---------------------------------------------------------------------------
header "2. .gitignore coverage"

gitignore_patterns=(".env" "node_modules" "__pycache__" "*.pem" ".DS_Store")
for p in "${gitignore_patterns[@]}"; do
  if grep -q "$p" .gitignore 2>/dev/null; then
    ok ".gitignore covers $p"
  else
    fail ".gitignore missing pattern: $p"
  fi
done

# .env must not be tracked by git
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
  fail ".env is tracked by git (SECURITY: must be gitignored)"
else
  ok ".env is not tracked by git"
fi

# ---------------------------------------------------------------------------
# 3. .env.example — no real secrets
# ---------------------------------------------------------------------------
header "3. .env.example — no real secrets"

# The sensitive fields must contain only placeholder values
placeholder_keys=(
  "SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "DIFY_SECRET_KEY"
  "DIFY_SANDBOX_API_KEY"
  "WEKALA_SECRET_KEY"
  "MEILI_MASTER_KEY"
  "N8N_ENCRYPTION_KEY"
  "LANGFUSE_SECRET_KEY"
  "CLICKHOUSE_PASSWORD"
)
for key in "${placeholder_keys[@]}"; do
  val=$(grep "^${key}=" .env.example 2>/dev/null | cut -d= -f2-)
  if [[ "$val" == CHANGE_ME* ]]; then
    ok ".env.example $key is a placeholder"
  else
    fail ".env.example $key has unexpected value: $val"
  fi
done

# ---------------------------------------------------------------------------
# 4. keygen idempotency
# ---------------------------------------------------------------------------
header "4. keygen idempotency"

if [ ! -f .env ]; then
  fail ".env not found — run 'make setup && make keygen' first"; echo
else
  checksum_before=$(sha256sum .env | cut -d' ' -f1)
  node scripts/keygen.js > /dev/null 2>&1
  checksum_after=$(sha256sum .env | cut -d' ' -f1)
  if [ "$checksum_before" = "$checksum_after" ]; then
    ok "keygen is idempotent (.env unchanged on second run)"
  else
    fail "keygen modified .env on second run (not idempotent)"
  fi
fi

# ---------------------------------------------------------------------------
# 5. docker-compose.yml syntax validation
# ---------------------------------------------------------------------------
header "5. Docker Compose config validation"

if docker compose config --quiet 2>/dev/null; then
  ok "docker-compose.yml parses without errors"
else
  fail "docker-compose.yml has syntax errors (run: docker compose config)"
fi

# ---------------------------------------------------------------------------
# 6. Service health checks (requires running stack)
# ---------------------------------------------------------------------------
header "6. Service health checks (stack must be running)"

# Load SUPABASE_ANON_KEY from .env for the authenticated check
ANON_KEY=""
if [ -f .env ]; then
  ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d= -f2-)
fi

declare -A services=(
  ["Supabase DB (authenticated)"]="http://localhost:8000/rest/v1/|apikey: ${ANON_KEY}"
  ["Supabase Studio"]="http://localhost:54323/"
  ["Dify Web"]="http://localhost:3000"
  ["Langfuse"]="http://localhost:3001/api/public/health"
  ["Ollama"]="http://localhost:11434/"
  ["Meilisearch"]="http://localhost:7700/health"
  ["n8n"]="http://localhost:5678/healthz"
  ["MailHog"]="http://localhost:8025"
)

for svc in "${!services[@]}"; do
  IFS='|' read -r url hdr <<< "${services[$svc]}"
  status=$(http_status "$url" "${hdr-}") || status="000"
  if [ "$status" -ge 200 ] && [ "$status" -lt 400 ] 2>/dev/null; then
    ok "$svc → HTTP $status"
  else
    fail "$svc → HTTP $status (expected 2xx/3xx)"
  fi
done

# ---------------------------------------------------------------------------
# 7. Kong rejects unauthenticated request
# ---------------------------------------------------------------------------
header "7. Kong authentication enforcement"

unauth_status=$(http_status "http://localhost:8000/rest/v1/") || unauth_status="000"
if [ "$unauth_status" = "401" ]; then
  ok "Kong returns 401 for unauthenticated request to /rest/v1/"
else
  fail "Kong returned $unauth_status (expected 401) for unauthenticated request"
fi

# ---------------------------------------------------------------------------
# 8. gitleaks secret scan
# ---------------------------------------------------------------------------
header "8. gitleaks secret scan"

if command -v gitleaks > /dev/null 2>&1; then
  if gitleaks detect --source . --no-banner --exit-code 1 > /dev/null 2>&1; then
    ok "gitleaks: no secrets found in repository"
  else
    fail "gitleaks: secrets detected in repository (run: gitleaks detect --source . --verbose)"
  fi
else
  echo "  ${CYAN}–${RESET}  gitleaks not installed — skipping (install with: brew install gitleaks)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
echo "${BOLD}─────────────────────────────────────${RESET}"
total=$((PASS+FAIL))
echo "${BOLD}Results: ${GREEN}$PASS passed${RESET} / ${RED}$FAIL failed${RESET} / $total total"
echo "${BOLD}─────────────────────────────────────${RESET}"
echo

if [ "$FAIL" -gt 0 ]; then
  echo "  ${RED}Phase 0 tests FAILED.${RESET} Fix the failures above before tagging."
  exit 1
else
  echo "  ${GREEN}Phase 0 tests PASSED.${RESET} Ready to tag phase-0-complete."
  exit 0
fi
