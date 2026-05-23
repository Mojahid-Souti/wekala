# Phase 7 — Developer SDK & API — Manual test

> Core slice: public-API authentication via Bearer API key, sliding-window
> rate limiting, signed webhook subscriptions with retrying delivery worker,
> filtered public OpenAPI spec, and a minimal Python SDK.
> Out of scope (deferred — §10): full Docusaurus docs portal, TypeScript SDK,
> per-workspace CORS allow-list, Idempotency-Key support, token-cost quotas,
> WebSocket transport, secret encryption-at-rest.

---

## 0. Pre-flight

- [ ] `make migrate` shows `0017` applied
- [ ] `docker logs wekala-opa --tail 5` shows the policy loaded with the new actions
- [ ] `make test-phase-7` runs green (file presence + 8 unit tests)
- [ ] `docker logs wekala-api --tail 10` shows the webhook delivery worker started
  (look for `Webhook delivery worker started.`)

---

## 1. API key + Bearer auth

- [ ] Workspace → Settings → **Developer** → create an API key named `Smoke`
- [ ] Full key shown ONCE (`wk_<40 hex>`); banner says it won't be shown again
- [ ] Reload the page → only the prefix appears (e.g. `wk_7089fbe1…`)
- [ ] `Authorization: Bearer wk_<correct full key>` on `/v1/agents/<id>/invoke` → 401 if agent not found, **but** the auth step PASSED (no "Missing API key")
- [ ] Wrong key `Authorization: Bearer wk_invalid` → **401 Invalid API key**
- [ ] Missing header → **401 Missing API key**
- [ ] Revoke the key in the UI → next request with that key → 401

## 2. Public invoke endpoint

> Setup: have one agent in the workspace with `status='published'` AND
> `vetting_status='approved'` (e.g. the Customer Support template that you
> auto-approved during Phase 6 §2 testing).

- [ ] `POST /v1/agents/{published-approved-id}/invoke` with `{"query":"Hello"}` → 200, body has `agent_id`, `answer`, `usage`, `latency_ms`
- [ ] Same call on a `status='draft'` agent → **409 Conflict** with message naming both `status` and `vetting_status` requirements
- [ ] Same call on a `status='published'` but `vetting_status='unvetted'` agent → 409
- [ ] Unknown agent UUID → 404
- [ ] Pass a query that's `""` → 422 (Pydantic min_length)
- [ ] Pass a 100 KB query → 422 (Pydantic max_length=32_000)

## 3. Rate limiting

Default per-key limits: 60/min, 10,000/day (configurable via env).

- [ ] In a loop, hit `/v1/agents/{id}/invoke` 70 times in under a minute → at some point you start getting **429** with `Retry-After: 60` and `X-RateLimit-*` headers
- [ ] Wait 60s → next call succeeds
- [ ] `api_request_log` rows are present: `SELECT count(*) FROM api_request_log WHERE api_key_id='…';`

## 4. Webhook subscription lifecycle

- [ ] In the Developer page, click **Add webhook**.
- [ ] URL = `http://192.168.0.5/x` → 400 "URL `http://...` resolves to a private address..."
- [ ] URL = `http://169.254.169.254/x` → 400 cloud-metadata
- [ ] URL = `file:///etc/passwd` → 400 scheme
- [ ] URL = `https://webhook.site/<your-test-id>` (or any public test endpoint), events = `agent.invoked` → 201
- [ ] Secret shown ONCE (`whsec_<48 hex>`); banner says it won't be shown again
- [ ] List view shows the subscription with `secret_prefix` only — no full secret leaked
- [ ] Delete → 204; list refreshes

## 5. Webhook fan-out + delivery worker

- [ ] Create a webhook → URL = `https://webhook.site/<your-test-id>`, events = `agent.invoked`
- [ ] Invoke a published+approved agent via API key → after a few seconds, `webhook.site` receives a POST with:
  - `Content-Type: application/json`
  - `X-Wekala-Event: agent.invoked`
  - `X-Wekala-Delivery: <uuid>`
  - `X-Wekala-Signature: sha256=<hex>`
  - Body: `{"delivery_id":"…","event":"agent.invoked","occurred_at":"…","data":{...}}`
- [ ] DB has the delivery row: `SELECT status, attempt_count, last_status_code FROM webhook_deliveries ORDER BY created_at DESC LIMIT 1;` → `status='success', attempt_count=1`

## 6. HMAC signature verification

Using the Python SDK:

```bash
make sdk-py
python -c "
from wekala import verify_webhook_signature
import hmac, hashlib
secret = 'whsec_<your secret>'
body   = b'{\"event\":\"agent.invoked\"}'
sig    = 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
print(verify_webhook_signature(secret, body, sig))   # True
print(verify_webhook_signature('whsec_wrong', body, sig))   # False
print(verify_webhook_signature(secret, b'TAMPERED', sig))   # False
print(verify_webhook_signature(secret, body, ''))           # False
"
```

- [ ] All four outputs match the comments

## 7. Retry policy

- [ ] Create a webhook with URL = `https://httpbin.org/status/500` (always 5xx)
- [ ] Invoke an agent → first delivery attempt fails
- [ ] Watch `webhook_deliveries`:
      `SELECT status, attempt_count, last_status_code, next_attempt_at FROM webhook_deliveries ORDER BY created_at DESC LIMIT 1;`
- [ ] Attempt count climbs to 5 over (1s + 5s + 25s + 125s + 625s)
- [ ] After attempt 5: `status='dead'`, `next_attempt_at IS NULL`

## 8. Public OpenAPI spec

- [ ] `curl http://localhost:8001/v1/openapi.json | jq '.paths | keys'` returns ONLY the public-tagged routes:
      `/v1/agents/{agent_id}/invoke`, `/v1/workspaces/{workspace_id}/webhooks*`
- [ ] **Internal routes are NOT present** (no `/v1/auth/login`, `/v1/workspaces`, `/v1/templates`, etc.)
- [ ] `curl http://localhost:8001/openapi.json` (the FULL internal spec) DOES include the internal routes (sanity check that the filter is real)

## 9. Python SDK quickstart

- [ ] `make sdk-py` installs the SDK editable
- [ ] In a Python REPL:
      ```python
      from wekala import WekalaClient
      c = WekalaClient(api_key="wk_…", base_url="http://localhost:8001")
      print(c.invoke_agent("<agent-uuid>", "Hello"))
      ```
- [ ] Wrong api_key shape (`"bad"`) raises `ValueError`
- [ ] Server 429 raises `RateLimitError` with `retry_after_seconds`

## 10. Out of scope (deferred follow-on)

- **Docusaurus docs portal** — Phase 7 ships with one README; full portal is a separate package
- **TypeScript SDK** — defer; openapi-generator-cli setup for both languages
- **Streaming endpoint (`/v1/agents/{id}/stream`)** — SDK client method exists but the server-side SSE generator is a follow-on slice
- **Per-workspace CORS allow-list** — server-to-server only for now
- **Idempotency-Key header support** — would dedupe identical client retries
- **Token-cost quotas** — needs Phase 8 cost tracking
- **Webhook secret encryption-at-rest** — currently plaintext in DB (standard industry practice; access-controlled via RLS). Encrypt with an app-level key in a follow-on.
- **Webhook delivery concurrency cap per subscription** — naive worker pulls up to 20/tick globally; add per-sub limit if storms become real

## 11. Notes / known design choices

- Webhook signing secret is **plaintext at rest** because HMAC requires us to read it for every signature. This mirrors GitHub, Stripe, and Slack. Access control via RLS on `webhook_subscriptions`. Encrypt-at-rest is a tracked follow-on.
- Rate limit storage is **Postgres-backed**, not Redis. Single index scan via `(api_key_id, ts DESC)` keeps it cheap at POC scale. Swap to Redis only if lock contention shows up.
- Webhook delivery worker runs **in the API process** as an asyncio task (started in lifespan). Cron-style sidecar would be overkill for v1.
- Public OpenAPI is **filtered by tag** — `tags=["public"]` or `tags=["webhooks"]` make the cut.
