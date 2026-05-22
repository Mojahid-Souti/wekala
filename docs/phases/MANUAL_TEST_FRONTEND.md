# Frontend manual test — user journey

> Run through this in a browser at `http://localhost:3002` after `make up`. Mark each scenario pass/fail.
> Frontend hot-reload is enabled: any file edit under `apps/web/` reflects without rebuild.

---

## 0. Pre-flight

- [ ] `docker compose ps` shows `wekala-web` and `wekala-api` healthy
- [ ] `curl http://localhost:8001/healthz` returns 200
- [ ] Browser: open DevTools → Network tab (filter on `localhost:8001`) and Console (watch for red errors)

---

## 1. Route protection (the bug you reported)

**Goal: unauthenticated users cannot reach protected pages.**

- [ ] Open an Incognito window. Go to `http://localhost:3002/dashboard` → redirected to `/login`
- [ ] Go to `http://localhost:3002/bazaar` → redirected to `/login`
- [ ] Go to `http://localhost:3002/workspaces/some-uuid` → redirected to `/login`
- [ ] Go to `http://localhost:3002/workspaces/new` → redirected to `/login`
- [ ] Already-logged-in: navigate to `/login` → redirected to `/dashboard`
- [ ] Already-logged-in: navigate to `/signup` → redirected to `/dashboard`

---

## 2. Sign-up & verification

- [ ] Visit `/signup`
- [ ] Submit with password < 12 chars → inline error "at least 12 characters"
- [ ] Submit valid email + 12+ char password → "Check your email" page
- [ ] Open MailHog at `http://localhost:8025` → verification email arrived
- [ ] Copy the OTP code from the email → paste into the verify form → success → redirected to `/login`
- [ ] Wrong code → "Invalid or expired code"

---

## 3. Sign-in

- [ ] Visit `/login`
- [ ] Wrong password → "Invalid email or password" (timing-safe; no user enumeration)
- [ ] Correct credentials → redirected to `/dashboard`
- [ ] DevTools → Application → Session Storage → `access_token` is set

---

## 4. Logout

- [ ] On any (app) page, click "Sign out" in the header (top right)
- [ ] Toast appears: "Signed out."
- [ ] Redirected to `/login`
- [ ] Session Storage → `access_token` is gone
- [ ] Try to navigate back to `/dashboard` via browser back button → redirected to `/login`

---

## 5. Dashboard — workspace list

- [ ] After login (with no workspaces yet): "No workspaces yet." empty state shown
- [ ] After creating one or more: cards render in a grid
- [ ] Hover on a card → shadow + border turn indigo
- [ ] Click on a card → navigates to that workspace's home (`/workspaces/{id}`)

---

## 6. Create workspace

- [ ] Click "Create workspace"
- [ ] Submit with empty name → button disabled (min 2 chars)
- [ ] Submit with name "DevTeam" + description "Test workspace" → toast "Workspace 'DevTeam' created successfully."
- [ ] Redirected to `/workspaces/{id}` (the home page, NOT dashboard)
- [ ] Try to create another workspace with **the same name** "DevTeam" → red banner: "You already have a workspace named 'DevTeam'. Choose a different name."
- [ ] Cancel button → back to dashboard

---

## 7. Workspace home page

- [ ] Sidebar shows: Overview / Agents / Knowledge Base / Members / Settings
- [ ] Active item is highlighted in indigo
- [ ] Stat cards show: Agents count, Members count (1 = you), Knowledge Bases (—)
- [ ] Clicking a stat card navigates to that section
- [ ] Quick actions: "+ New agent", "Upload documents", "Browse Bazaar"
- [ ] Members section shows you as `admin`
- [ ] Workspace name + description render at the top

---

## 8. Invite a member

> Setup: create a second test user (use signup flow with a different email and verify the email via MailHog).

- [ ] In workspace home → "Invite a member" form
- [ ] Enter the second user's email + select role "builder" → click "Send invite"
- [ ] Toast "Member invited successfully"
- [ ] Members list refreshes → second user appears with role "builder"
- [ ] Enter a non-existent email → red banner "User not found"
- [ ] Click "Remove" on the second user → they disappear; toast "Member removed"

---

## 9. Workspace settings — edit

- [ ] Sidebar → Settings
- [ ] Name and description fields are pre-filled with current values
- [ ] Slug is shown read-only below the name field
- [ ] "Save changes" button is disabled until something changes
- [ ] Change description → "Save changes" + "Discard" buttons activate
- [ ] Click "Discard" → fields revert
- [ ] Change name to a NEW value → save → toast "Workspace '...' updated."
- [ ] Slug updates to match new name
- [ ] Sidebar workspace items remain functional
- [ ] Navigate back to dashboard → card shows new name
- [ ] Change name to an existing workspace's name → red banner "You already have a workspace named..."

---

## 10. Workspace settings — delete

- [ ] Sidebar → Settings → scroll to "Danger zone"
- [ ] Click "Delete this workspace" → confirmation panel appears
- [ ] Type the workspace name **incorrectly** → "I understand, delete it" button stays disabled
- [ ] Type the workspace name **exactly** → button enables
- [ ] Click delete → toast "Workspace deleted." → redirected to `/dashboard`
- [ ] The deleted workspace no longer appears on the dashboard
- [ ] Try to visit the old `/workspaces/{deleted-id}` URL → redirected to `/login` (no membership = 403 cascades into your error handling)

---

## 11. Agents (Phase 2 sanity)

- [ ] Sidebar → Agents → loads agent list (empty initially)
- [ ] Click "New Agent" → upload-YAML / from-template form appears
- [ ] (Phase 2 testing was already done; just smoke-check that the page loads)

---

## 12. Knowledge Base (Phase 4 sanity)

- [ ] Sidebar → Knowledge Base → empty state "No knowledge bases yet"
- [ ] Click "New Knowledge Base" → form appears → create one
- [ ] Upload a small PDF → status `pending` → transitions to `ready` within ~30s
- [ ] Search the KB → chunks returned with filename citations
- [ ] (Phase 4 testing covered the deep cases; this is just a smoke check)

---

## 13. Bazaar (Phase 3 sanity)

- [ ] Top-nav → Bazaar → loads catalog page
- [ ] Empty for now (no published agents yet)

---

## 14. Session/navigation edge cases

- [ ] Refresh page on `/workspaces/{id}` → sidebar/content reload correctly (no flicker beyond loading state)
- [ ] Open two tabs both logged in → both work; sign out in one → other tab still authed until next navigation (sessionStorage is per-tab; this is expected)
- [ ] Wait for JWT to expire (1h) → next API call returns 401 → page shows an error (TODO: auto-redirect on 401 — known gap)

---

## Known limitations (not bugs)

- **No auto-logout on expired token**: currently the user has to manually sign out and back in. Adding a 401 interceptor in `lib/api.ts` is a future enhancement.
- **No "remember me"**: sessionStorage clears on tab close. Switching to localStorage would persist, but reduces security.
- **No password change UI**: only password reset via email.
- **Member rows show UUIDs, not names/emails**: backend stores users in Supabase auth.users; we don't currently join. Could be added with a batch lookup later.
