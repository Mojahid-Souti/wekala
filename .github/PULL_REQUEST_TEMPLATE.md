## Phase

<!-- e.g. Phase 1 — Authentication -->

## Summary

<!-- What does this PR do? 2-3 sentences. -->

## Changes

- [ ] New files created
- [ ] Existing files modified
- [ ] DB migration added (reversible — tested up + down on fresh DB)
- [ ] API endpoints added / changed
- [ ] Breaking changes (describe below if yes)

## Security review notes

<!-- Per Rule 1: note any new secrets, endpoints, authorization boundaries, RLS changes, audit log additions. -->

- Secrets introduced: none / `<name>`
- New endpoints: none / `POST /v1/...`
- RLS policies: not applicable / added for `<table>`
- Audit log entries: not applicable / added for `<action>`

## Algorithmic complexity

<!-- Per Rule 6: note the Big-O for any non-trivial function. -->

- Hot path: O(?) over `<what n represents>`
- Worst case: O(?)
- Data structures chosen: `<hash map / heap / sorted set / …>`

## Manual test evidence

<!-- Per Rule 3: paste key results from MANUAL_TEST_PHASE_N.md. -->

- [ ] Scenario 1 (happy path): PASS
- [ ] Scenario 2 (error case): PASS
- [ ] Scenario N (edge case): PASS

Full checklist: `docs/phases/MANUAL_TEST_PHASE_N.md`

## Breaking changes

<!-- BREAKING CHANGE: describe impact + migration path, or "none" -->

none
