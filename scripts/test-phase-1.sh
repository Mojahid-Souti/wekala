#!/usr/bin/env bash
# =============================================================================
# WEKALA — Phase 1 automated integration tests
#
# Requires: running stack (make up + make migrate)
# Usage:    bash scripts/test-phase-1.sh
# =============================================================================

set -euo pipefail

BOLD=$'\033[1m'
GREEN=$'\033[32m'
RED=$'\033[31m'
CYAN=$'\033[36m'
RESET=$'\033[0m'

PASS=0
FAIL=0

API="http://localhost:8001"
MAILHOG="http://localhost:8025"

# Load .env if present
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

pass() { echo "  ${GREEN}✓${RESET} $1"; PASS=$((PASS+1)); }
fail() { echo "  ${RED}✗${RESET} $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "${BOLD}$1${RESET}"; }

# Helper: HTTP call returning status code (always exits 0; curl outputs "000" on conn refused)
http() {
  local method="$1" url="$2"; shift 2
  curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" "$@" 2>/dev/null || true
}

# Helper: HTTP call returning body (always exits 0)
http_body() {
  local method="$1" url="$2"; shift 2
  curl -s -X "$method" "$url" "$@" 2>/dev/null || true
}

# Random suffix to avoid email collisions across test runs
SUFFIX=$(openssl rand -hex 4)
EMAIL1="test-user-a-${SUFFIX}@wekala-dev.com"
EMAIL2="test-user-b-${SUFFIX}@wekala-dev.com"
PASSWORD="TestPassw0rd!Dev"   # 16 chars — satisfies min-12 policy

# =============================================================================
# 1. API reachable
# =============================================================================
section "1. API reachability"
STATUS=$(http GET "${API}/healthz")
if [ "$STATUS" -eq 200 ]; then pass "GET /healthz → 200"; else fail "GET /healthz → $STATUS (expected 200)"; fi

# =============================================================================
# 2. OPA reachable and policy loaded
# =============================================================================
section "2. OPA policy"
OPA_STATUS=$(http POST "http://localhost:8181/v1/data/wekala/authz/allow" \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"admin","action":"workspace.update"}}')
if [ "$OPA_STATUS" -eq 200 ]; then pass "OPA /v1/data/wekala/authz/allow → 200"; else fail "OPA policy endpoint → $OPA_STATUS (expected 200)"; fi

OPA_BODY=$(http_body POST "http://localhost:8181/v1/data/wekala/authz/allow" \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"admin","action":"workspace.update"}}')
if echo "$OPA_BODY" | grep -q '"result":true'; then pass "admin can workspace.update → OPA allow=true"; else fail "admin allow=true not found in: $OPA_BODY"; fi

OPA_BODY2=$(http_body POST "http://localhost:8181/v1/data/wekala/authz/allow" \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"hirer","action":"workspace.update"}}')
if echo "$OPA_BODY2" | grep -q '"result":false\|"result":null\|{}'; then pass "hirer cannot workspace.update → OPA deny"; else fail "OPA should deny hirer from workspace.update, got: $OPA_BODY2"; fi

# =============================================================================
# 3. Signup — happy path
# =============================================================================
section "3. Signup"
SIGNUP_STATUS=$(http POST "${API}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL1}\",\"password\":\"${PASSWORD}\"}")
if [ "$SIGNUP_STATUS" -eq 201 ]; then pass "POST /v1/auth/signup → 201"; else fail "POST /v1/auth/signup → $SIGNUP_STATUS (expected 201)"; fi

# =============================================================================
# 4. Signup — password too short (< 12 chars)
# =============================================================================
section "4. Password policy"
SHORT_STATUS=$(http POST "${API}/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"short-${SUFFIX}@wekala.test\",\"password\":\"short\"}")
if [ "$SHORT_STATUS" -eq 422 ]; then pass "POST /v1/auth/signup short password → 422"; else fail "Short password should be 422, got $SHORT_STATUS"; fi

# =============================================================================
# 5. Login before email verification → must fail
# =============================================================================
section "5. Login before verification"
LOGIN_BEFORE=$(http POST "${API}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL1}\",\"password\":\"${PASSWORD}\"}")
if [ "$LOGIN_BEFORE" -eq 401 ]; then pass "Login before verify → 401"; else fail "Login before verify should be 401, got $LOGIN_BEFORE"; fi

# =============================================================================
# 6. Email arrives in MailHog within 10 s
# =============================================================================
section "6. Email delivery"
EMAIL_FOUND=0
for i in $(seq 1 10); do
  sleep 1
  if curl -sf "${MAILHOG}/api/v2/messages" | grep -q "${EMAIL1}"; then
    EMAIL_FOUND=1
    break
  fi
done
if [ "$EMAIL_FOUND" -eq 1 ]; then pass "Verification email arrived in MailHog"; else fail "Verification email NOT found in MailHog after 10 s"; fi

# =============================================================================
# 7. Unauthenticated access to workspace endpoints → 403
# =============================================================================
section "7. Authorization boundaries (no token)"
for path in "/v1/workspaces" "/v1/auth/me"; do
  S=$(http GET "${API}${path}")
  if [ "$S" -eq 403 ] || [ "$S" -eq 401 ]; then
    pass "GET ${path} without token → $S"
  else
    fail "GET ${path} without token → $S (expected 401/403)"
  fi
done

# =============================================================================
# 8. Workspace creation requires auth → 403 without token
# =============================================================================
section "8. Workspace creation auth guard"
WS_UNAUTH=$(http POST "${API}/v1/workspaces" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test WS"}')
if [ "$WS_UNAUTH" -eq 403 ] || [ "$WS_UNAUTH" -eq 401 ]; then
  pass "POST /v1/workspaces without token → $WS_UNAUTH"
else
  fail "POST /v1/workspaces without token → $WS_UNAUTH (expected 401/403)"
fi

# =============================================================================
# 9. Member invite requires admin role (OPA policy)
# =============================================================================
section "9. OPA role enforcement"
VIEWER_INVITE=$(http_body POST "http://localhost:8181/v1/data/wekala/authz/allow" \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"viewer","action":"workspace.invite"}}')
if echo "$VIEWER_INVITE" | grep -q '"result":false\|"result":null\|{}'; then
  pass "viewer cannot workspace.invite → OPA deny"
else
  fail "OPA should deny viewer from workspace.invite, got: $VIEWER_INVITE"
fi

BUILDER_AGENT=$(http_body POST "http://localhost:8181/v1/data/wekala/authz/allow" \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"builder","action":"agent.create"}}')
if echo "$BUILDER_AGENT" | grep -q '"result":true'; then
  pass "builder can agent.create → OPA allow"
else
  fail "OPA should allow builder for agent.create, got: $BUILDER_AGENT"
fi

HIRER_AGENT=$(http_body POST "http://localhost:8181/v1/data/wekala/authz/allow" \
  -H "Content-Type: application/json" \
  -d '{"input":{"role":"hirer","action":"agent.create"}}')
if echo "$HIRER_AGENT" | grep -q '"result":false\|"result":null\|{}'; then
  pass "hirer cannot agent.create → OPA deny"
else
  fail "OPA should deny hirer from agent.create, got: $HIRER_AGENT"
fi

# =============================================================================
# 10. Rate-limit plugin loaded in Kong (signup route exists)
# =============================================================================
section "10. Kong rate-limit plugin"
KONG_ROUTE=$(http POST "http://localhost:8000/auth/v1/signup" \
  -H "Content-Type: application/json" \
  -d '{}')
# 400 (invalid body) or 422 or 429 are all acceptable — proves Kong routed it
if [ "$KONG_ROUTE" -ge 400 ] && [ "$KONG_ROUTE" -le 499 ]; then
  pass "Kong /auth/v1/signup route active → HTTP $KONG_ROUTE"
else
  fail "Kong /auth/v1/signup route unexpected status → $KONG_ROUTE"
fi

# =============================================================================
# 11. Kong /api/v1/* route → wekala-api
# =============================================================================
section "11. Kong API routing"
# /api/v1/auth/me: Kong strips /api → proxies /v1/auth/me to wekala-api.
# wekala-api returns 401 (no token) which proves the route is correctly wired.
KONG_API=$(http GET "http://localhost:8000/api/v1/auth/me")
if [ "$KONG_API" -eq 401 ]; then
  pass "GET /api/v1/auth/me via Kong → 401 (routed to wekala-api; auth enforced there)"
else
  fail "Kong /api/v1/* routing → $KONG_API (expected 401 from wekala-api)"
fi

# =============================================================================
# 12. Password reset — always 204 (no user enumeration)
# =============================================================================
section "12. No user enumeration on reset"
RESET_KNOWN=$(http POST "${API}/v1/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL1}\"}")
RESET_UNKNOWN=$(http POST "${API}/v1/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@wekala-dev.com"}')
if [ "$RESET_KNOWN" -eq 204 ] && [ "$RESET_UNKNOWN" -eq 204 ]; then
  pass "Password reset returns 204 for known and unknown emails (no enumeration)"
else
  fail "Password reset should be 204 for both; got known=$RESET_KNOWN unknown=$RESET_UNKNOWN"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "========================================"
TOTAL=$((PASS+FAIL))
echo "${BOLD}Phase 1 tests: ${PASS}/${TOTAL} passed${RESET}"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  echo "${RED}${FAIL} test(s) failed — fix before tagging phase-1-complete${RESET}"
  exit 1
else
  echo "${GREEN}All tests passed!${RESET}"
fi
