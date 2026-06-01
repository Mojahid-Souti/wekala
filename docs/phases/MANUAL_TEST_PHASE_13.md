# Manual Test Checklist — Phase 13: App shell + dashboard + tabbed settings

Run after `make up` (and `docker compose restart opa` if `make health` shows "OPA policies ✗").
Log in as a workspace **admin** unless a step says otherwise. Web at `http://localhost:3002`.

---

## Prerequisites

- [ ] `make health` shows all services ✓ **including "OPA policies ✓ loaded"**
- [ ] API rebuilt since the member-identity change (`docker compose up -d --build wekala-api`)
- [ ] You are signed in and have at least one workspace

---

## 1. App shell — sidebar

**Steps:** Toggle the sidebar (header `⌘/Ctrl-K` is search; the panel icon toggles).

**Expected:**
- Sidebar collapses to icons and expands; **state persists across reload** (`localStorage`).
- Collapsed sidebar shows tooltips on hover; main content shifts/animates with it.
- Active route is highlighted; the **Agents** and **Settings** groups expand to children.

- [ ] Pass  [ ] Fail

## 2. Header breadcrumb

**Steps:** Navigate to Settings → Members.

**Expected:** Breadcrumb reads **Workspace › Settings › Members**; segments before the last are clickable.

- [ ] Pass  [ ] Fail

## 3. Dashboard

**Steps:** Open the dashboard (Home).

**Expected:** Greeting uses your **first name**; KPI strip (when there's activity); quick actions; "Your agents"; **Recent activity** sourced from `audit_log`.

- [ ] Pass  [ ] Fail

## 4. Workspace home — members preview

**Steps:** Open the workspace home (`/workspaces/{id}`).

**Expected:**
- Stat tiles (Agents / Members / Knowledge bases) + quick actions.
- Members section is a **read-only preview** showing **real names + email** (not UUIDs), with avatars and a role chip.
- "Manage members" / "View all" links go to **Settings → Members**.

- [ ] Pass  [ ] Fail

## 5. Settings — sidebar nav (collapsible parent)

**Steps:** In the sidebar, expand **Settings**.

**Expected:** Children **General / Members / Developer**; each navigates to its tab and highlights when active.

- [ ] Pass  [ ] Fail

## 6. Settings — tab bar + layout

**Steps:** Open Settings; click across **General / Members / Developer / Danger zone**.

**Expected:**
- URL changes per tab (`/settings`, `/settings/members`, `/settings/developer`, `/settings/danger`); **browser Back** moves between tabs.
- Page width matches the home page (`max-w-[1400px]`); each tab uses the **label-left / controls-right** section layout.
- Active tab underlined.

- [ ] Pass  [ ] Fail

## 7. General tab

**Steps:** Edit the workspace name and/or description → **Save changes**.

**Expected:** Save disabled until a valid change; success toast; slug shown read-only; **Discard** reverts.

- [ ] Pass  [ ] Fail

## 8. Members tab — identity + management

**Steps:** Open Members.

**Expected:**
- List shows **real name + email** per member; your own row marked **"You"**.
- Invite a teammate by email + role → appears in the list (toast).
- Remove a member (not yourself) → disappears.

- [ ] Pass  [ ] Fail

## 9. Developer tab

**Steps:** Open Developer.

**Expected:** **API keys** and **Webhooks** as two labeled sections; create a key (shown once); create a webhook (secret shown once); neutral styling (no indigo).

- [ ] Pass  [ ] Fail

## 10. Danger zone

**Steps:** Open Danger zone.

**Expected:** Rose-tinted delete card; the delete button is **disabled until you type the exact workspace name**. (Only confirm the delete on a throwaway workspace.)

- [ ] Pass  [ ] Fail

## 11. Role gating (non-admin)

**Steps:** Sign in as a **non-admin** (viewer/builder) member of a workspace and open Settings.

**Expected:**
- Only the **General** tab is shown; **Members / Developer / Danger zone** tabs are hidden.
- Directly visiting `/settings/developer` (or `/members`, `/danger`) **redirects to General**.
- General fields are read-only with an "admins only" note.

- [ ] Pass  [ ] Fail

## 12. Legacy route redirect

**Steps:** Visit `/workspaces/{id}/members` directly.

**Expected:** Redirects to **Settings → Members** (`/settings/members`).

- [ ] Pass  [ ] Fail

## 13. No regressions

**Steps:** Click through Agents, Knowledge base, Tools, Bazaar, Command Center.

**Expected:** All previously-built pages still render and navigate normally.

- [ ] Pass  [ ] Fail

---

## Summary

| # | Scenario | Result |
|---|---|---|
| 1 | Sidebar collapse + persist | |
| 2 | Breadcrumb | |
| 3 | Dashboard (recent activity) | |
| 4 | Home members preview (names) | |
| 5 | Sidebar Settings children | |
| 6 | Settings tab bar + width | |
| 7 | General edit | |
| 8 | Members identity + manage | |
| 9 | Developer (keys + webhooks) | |
| 10 | Danger zone confirm | |
| 11 | Role gating (non-admin) | |
| 12 | /members redirect | |
| 13 | No regressions | |

**Tester:** _______________  **Date:** _______________
