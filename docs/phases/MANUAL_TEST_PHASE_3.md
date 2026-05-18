# Manual Test Checklist — Phase 3 (Bazaar)

Run after `make up` + `make migrate` with a fresh DB. Requires at least one published agent from Phase 2.

---

## Prerequisites

- Stack running (`make up`)
- Migrations applied (`make migrate`)
- Two test workspaces: **WS-A** (user Alice, role=Hirer) and **WS-B** (user Bob, role=Viewer)
- At least one agent published in WS-A (use Phase 2 publish flow)

---

## Scenario 1 — Catalog loads in English

**Steps:**
1. Log in as Alice → navigate to `/bazaar`

**Expected:**
- Page title and all labels appear in English (no untranslated keys like `bazaar.catalog.title`)
- Search bar, category chips, and agent grid are visible
- `grep -r 'bazaar\.' apps/web/app/\(app\)/bazaar/ | grep -v "t('" | grep '"` returns no hardcoded strings

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 2 — Full-text search

**Steps:**
1. Type part of the published agent's name in the search bar
2. Wait 300ms debounce
3. Observe results; check URL contains `?q=<query>`
4. Press browser Back → URL restores previous state

**Expected:**
- Results filter to matching agents
- URL reflects search state (shareable link)
- Back button restores previous empty search

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 3 — Category filter

**Steps:**
1. Click one or more category chips (e.g. "Customer Support")
2. Verify results update; check URL contains `?cat=<id>`
3. Combine with a search query

**Expected:**
- Only agents in selected categories appear
- URL remains bookmarkable
- Combining search + category filters both constraints

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 4 — Pagination

**Steps:**
1. Seed 25+ published agents (or set page size to 5 via a temporary URL override)
2. Navigate to page 2

**Expected:**
- Page 1 shows 20 results (default)
- Page 2 shows remaining results
- TanStack Query does not re-fetch page 1 when switching back to it (cached)

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 5 — Agent detail page

**Steps:**
1. Click on any agent card
2. Review the detail page at `/bazaar/<agentId>`

**Expected:**
- Agent name, description, classification badge, tags are shown
- Hire button is visible (not yet hired)
- Rating section shows "No ratings yet" (or avg if reviews exist)
- Review form is not visible until hired (see Scenario 8)

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 6 — Hire flow (happy path)

**Steps:**
1. Log in as Alice (Hirer in WS-A)
2. Navigate to a published agent's detail page
3. Click "Hire"

**Expected:**
- Button changes to "Hired ✓" within 1s (optimistic update)
- `GET /v1/workspaces/<WS-A>/hires` response includes the agent
- Agent appears in `/bazaar/hired`

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 7 — Re-hire is idempotent

**Steps:**
1. Hire the same agent again (via API: `POST /v1/workspaces/<WS-A>/hires?agent_id=<id>` twice)

**Expected:**
- Second request returns 201 with the same hire ID as the first
- DB has exactly one row in `hires` for this `(workspace_id, agent_id)` pair

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 8 — Cross-workspace hire isolation

**Steps:**
1. Alice hires agent X in WS-A
2. Log in as Bob (WS-B)
3. Navigate to same agent's detail page

**Expected:**
- Bob sees "Hire" button (not hired), not "Hired ✓"
- `GET /v1/workspaces/<WS-B>/hires` does NOT include agent X
- Bob cannot see WS-A's hire list (403 if he calls the WS-A endpoint)

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 9 — Unhire

**Steps:**
1. Navigate to `/bazaar/hired` as Alice
2. Click "Unhire" on a hired agent

**Expected:**
- Agent disappears from the hired list immediately (optimistic update)
- `DELETE /v1/workspaces/<WS-A>/hires/<agentId>` returns 204
- Hiring the same agent again works (re-hire after unhire)

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 10 — Submit review (happy path)

**Steps:**
1. Alice hires an agent (must be hired to review)
2. Navigate to agent detail; click 4 stars; type a review body; submit

**Expected:**
- Review appears in the review list
- Audit log contains `review.create` entry

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 11 — k-anonymity on ratings (< 3 reviewers)

**Steps:**
1. Submit 1 or 2 reviews for an agent (from different users, same agent)
2. View the agent detail page / call `GET /v1/bazaar/agents/<id>`

**Expected:**
- `avg_rating` field is `null` in the response
- `review_count` is 1 or 2
- Star display shows "Not enough ratings" or similar (no numeric average shown)

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 12 — k-anonymity threshold met (≥ 3 reviewers)

**Steps:**
1. Submit a 3rd review for the same agent from a 3rd user

**Expected:**
- `avg_rating` is now a numeric value (e.g. 4.0)
- `review_count` is 3
- Star rating displays the average

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 13 — Profanity filter on review body

**Steps:**
1. Submit a review with a profanity word in the body (e.g. "This is shit")

**Expected:**
- Review is accepted (not rejected outright — profanity is filtered, not blocked, in Phase 3)
- Stored body has the word censored (e.g. "This is ****")
- OR: review is rejected with a 422 if service is configured to block (check `bazaar_service.py` for current behavior)

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 14 — Review schema validation

**Steps:**
1. Submit review with `rating=0` → expect 422
2. Submit review with `rating=6` → expect 422
3. Submit review with `body` of 2001 characters → expect 422

**Expected:** All three return 422 Unprocessable Entity

**Pass:** [ ] **Fail:** [ ]

---

## Scenario 15 — Unauthenticated access blocked

**Steps:**
1. Without auth header: `GET /v1/bazaar/agents?workspace_id=<any-uuid>`
2. Without auth header: `POST /v1/workspaces/<id>/hires?agent_id=<id>`
3. Without auth header: `GET /v1/bazaar/categories`

**Expected:** All return 401 or 403

**Pass:** [ ] **Fail:** [ ]

---

## Results summary

| # | Scenario | Pass | Fail | Notes |
|---|---|---|---|---|
| 1 | Catalog loads in English | | | |
| 2 | Full-text search | | | |
| 3 | Category filter | | | |
| 4 | Pagination | | | |
| 5 | Agent detail page | | | |
| 6 | Hire flow | | | |
| 7 | Re-hire idempotent | | | |
| 8 | Cross-workspace isolation | | | |
| 9 | Unhire | | | |
| 10 | Submit review | | | |
| 11 | k-anonymity < 3 | | | |
| 12 | k-anonymity ≥ 3 | | | |
| 13 | Profanity filter | | | |
| 14 | Review validation | | | |
| 15 | Auth guard | | | |

All 15 pass → run `git tag -a phase-3-complete -m "Phase 3: Bazaar marketplace" && git push origin phase-3-complete`
