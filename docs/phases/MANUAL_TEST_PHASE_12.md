# Phase 12 — Auth flow redesign — Manual test

> Core slice: four auth pages rebuilt with shadcn primitives in a
> Flynt-style split layout (form left, brand panel right). Sign-up gains
> a full-name field, password strength meter, confirm-password field,
> and required Terms checkbox. Sign-in adds "Remember me" (sessionStorage
> ↔ localStorage swap) and disabled Google/Apple buttons with "Coming
> soon" tooltips. Verify-email replaces the single text input with a
> 6-cell OTP that auto-advances and auto-submits. Reset-password becomes
> a 2-step flow: request a link + set a new password.
>
> Out of scope (deferred): post-signup onboarding wizard (Phase 11 follow-up),
> Google/Apple OAuth wiring, MFA flow.

---

## 0. Pre-flight

- [ ] `docker compose ps` → `wekala-web`, `wekala-api`, `wekala-supabase-db`, `wekala-supabase-auth` all healthy
- [ ] MailHog reachable at `http://localhost:8025`
- [ ] `pnpm lint` + `pnpm type-check` both green
- [ ] In Supabase Studio (`http://localhost:54323`) → Authentication → Settings: "Confirm email" enabled

## 1. Sign-up — happy path

Visit `/signup`.

- [ ] Form panel renders with W tile + "Create your account" + "Start building, vetting, and hiring AI agents in minutes."
- [ ] **Submit button disabled** while: name < 2 chars, email empty, password < 12, confirm ≠ password, or Terms unchecked
- [ ] Type full name `Test User`, email `test+phase12@example.com`, password `MyStrongP@ssw0rd!`, confirm same, check Terms
- [ ] **Strength meter** appears under password field: shows 4 segments, color goes from red (1-char) → amber (5-7 chars) → emerald (12+ varied) → deep emerald (16+ varied)
- [ ] Eye toggle on both password fields flips between dot mask and clear text
- [ ] Submit → redirect to `/verify?email=test%2Bphase12%40example.com`
- [ ] In Supabase Studio → Authentication → Users → the new user shows `user_metadata.full_name = "Test User"`

## 2. Sign-up — validation edges

- [ ] Type `A` in Full name → blur → inline error "Name must be between 2 and 60 characters" appears in red below the input; input border turns red
- [ ] Fix to `Ab` → error clears
- [ ] Type password `short` → inline "Password must be at least 12 characters" appears
- [ ] Type confirm `differentPassword` → blur → "Passwords do not match" appears
- [ ] Uncheck Terms → submit button immediately disables
- [ ] Try posting `<script>alert(1)</script>` as full name → submits the literal string; in Supabase the metadata field stores it as plain text (escaped on render, never executed)
- [ ] Hover Google / Apple buttons → black "Coming soon" tooltip appears above each; clicking does nothing (preventDefault)

## 3. Verify-email — OTP paste-only behaviour

After sign-up you land on `/verify?email=...`. Open MailHog, copy the
6-digit code from the most recent email.

- [ ] Page renders: W tile + "Check your email" + "We sent a 6-digit code to **test+phase12@example.com**"
- [ ] Six separated rounded cells (h-14 × w-12, gap-2, neutral-200 border)
- [ ] Below the cells: hint "Copy the 6-digit code from the email and paste it here."
- [ ] First cell auto-focused with a blinking caret (1.2s `otp-caret-blink`)
- [ ] **Typing on the keyboard does NOTHING** — cells stay empty (inputMode="none" + onChange filter rejects single-char additions)
- [ ] Copy the 6-digit code from MailHog → click any cell → **Cmd/Ctrl+V** → all 6 cells populate at once with the code
- [ ] **Verification fires automatically without a button click**; spinner + "Verifying…" text appear
- [ ] On success: cells replaced with green check circle + "Email verified" → auto-redirect to `/login` after 2s

## 4. Verify-email — failure path (the bug fixed in this phase)

Visit `/verify?email=...` for an unverified user. Type 6 incorrect digits
(e.g. `000000`).

- [ ] **Exactly ONE** POST to `/auth/v1/verify` fires (open DevTools → Network, filter `verify`)
- [ ] Red `Alert` appears: "Invalid or expired code. Please request a new one."
- [ ] **All 6 cells auto-clear** so the user can type a fresh code without manually deleting
- [ ] First cell re-focused with caret
- [ ] Type a different 6-digit code → fires verification again (single POST, not a loop)

## 5. Verify-email — manual typing is blocked

- [ ] On `/verify?email=...`, focus the first OTP cell
- [ ] Press any digit key on the keyboard → **nothing happens** (cells stay empty)
- [ ] Try pressing letters / symbols → also nothing
- [ ] The only way to fill the cells is via paste (covered in section 3)

## 6. Sign-in — "Remember me" toggle

Sign out if signed in. Visit `/login`.

- [ ] Form layout: W tile + "Welcome back!" + Mail icon input + Lock icon input + Remember me / Forgot password row + black "Sign In" button + "Or sign in with" divider + Google/Apple disabled buttons + "Don't have an account? Create an account" + footer
- [ ] Sign in **without** Remember me checked → DevTools Application → Storage:
  - `sessionStorage` has `access_token` + `refresh_token`
  - `localStorage` has NO `access_token` / `refresh_token` / `wekala_remember_me`
- [ ] Sign out, return to `/login`
- [ ] Sign in **with** Remember me checked → DevTools:
  - `localStorage` has `access_token` + `refresh_token` + `wekala_remember_me=1`
  - `sessionStorage` has NO `access_token` / `refresh_token`
- [ ] **Close the entire tab** → reopen `/dashboard` directly → still signed in (proves localStorage persistence)
- [ ] Sign out → all six storage keys cleared from both stores

## 7. Sign-in — wrong credentials

- [ ] On `/login`, type a real email + wrong password → submit → red `Alert` at top: "Invalid email or password" (the same message whether the email exists or not — no enumeration)
- [ ] Submit button disabled until both fields non-empty
- [ ] Eye toggle flips password mask
- [ ] Tab order: Email → Password → eye toggle → Remember me → Forgot password → Sign In

## 8. Reset password — request step

Visit `/login` → click "Forgot password" link.

- [ ] Flips to `/reset-password` — form panel: W tile + "Forgot your password?" + "Enter your email and we'll send you a reset link."
- [ ] Mail-icon input renders; submit disabled when empty
- [ ] Type the email of an existing verified user → click "Send reset link"
- [ ] **Form replaces** with green check circle + "Check your inbox" + email shown in bold + "Didn't receive the email? Resend link" (with 60s cooldown showing `Resend in 59s…` counting down)
- [ ] During cooldown the Resend button is greyed out + `cursor-not-allowed`
- [ ] After 60s, button is enabled and underlined
- [ ] Open MailHog → reset email arrives within 5s; the link's `redirect_to` resolves to `http://localhost:3002/reset-password/new`

## 9. Reset password — completion step

Click the link in the reset email.

- [ ] Browser opens `http://localhost:3002/reset-password/new#access_token=...&type=recovery&...`
- [ ] Page renders: W tile + "Set a new password" + "Choose a strong password for your account."
- [ ] Lock-icon input "Enter a new password" + eye toggle + strength meter
- [ ] Lock-icon input "Re-enter your new password" + eye toggle
- [ ] Type new password ≥ 12 chars + matching confirm → submit button enables
- [ ] Submit → green check + "Password updated" + toast "Password updated successfully." → auto-redirect to `/login` after 1.5s
- [ ] Sign in with the new password → succeeds
- [ ] Sign in with the OLD password → fails with "Invalid email or password"

## 10. Reset password — completion without session

Visit `/reset-password/new` **directly** (no recovery hash) in a fresh
incognito window.

- [ ] After ~200ms, page renders: W tile + "Reset link expired or invalid" + "Request a new password reset link to continue." + black "Request a new link" button that goes to `/reset-password`

## 11. Flip transition + brand-panel persistence (Phase 11 integration)

These were validated in Phase 11; re-confirm they still hold for all
four redesigned pages.

- [ ] From `/login` → "Create an account" → form flips in, brand panel preserves scene
- [ ] From `/signup` → "Sign in" → flips back
- [ ] From `/login` → "Forgot password" → flips
- [ ] From `/reset-password` "Back to sign in" → flips back
- [ ] Brand panel scene index never resets during any of these transitions

## 12. Backend — `full_name` propagation

- [ ] Sign up a new user with `full_name = "أحمد العامري"` (non-Latin Unicode)
- [ ] Supabase Studio → the user's `user_metadata.full_name` shows the exact string
- [ ] `apps/api/wekala/api/v1/auth.py::SignUpRequest.full_name_length` rejects `"a"` (too short) and `"x" * 61` (too long) — test via `curl -X POST http://localhost:8001/v1/auth/signup -d '{"email":"...","password":"...","full_name":"a"}'`
- [ ] Existing signup payloads without `full_name` still succeed (backwards compatible)

## 13. Regression — auth-guarded routes still work

- [ ] Signed in, visit `/dashboard`, `/bazaar`, `/workspaces/<id>` → all render as before (no shadcn restyling, no flip)
- [ ] Sign out from the user menu → toast "Signed out." + redirect to `/login`
- [ ] Try visiting `/dashboard` directly while signed out → redirected to `/login` (AuthGuard works)
- [ ] Try visiting `/login` while signed in → redirected to `/dashboard` (GuestGuard works)

---

## Acceptance

- [ ] All sections 1–13 checked
- [ ] No infinite-loop or rapid-fire network requests on any failure path
- [ ] Lighthouse a11y on each of `/login`, `/signup`, `/verify?email=x`, `/reset-password`, `/reset-password/new` ≥ 90

Once all boxes are ticked, request tag `phase-12-complete`.
