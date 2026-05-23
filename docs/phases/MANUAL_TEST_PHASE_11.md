# Phase 11 — Design system foundation — Manual test

> Core slice: shadcn/ui v4 installed, light-mode design tokens, AuthShell
> with left-side brand panel (interactive laptop mockup + scene-synced
> testimonial), AnimatedFormPanel with 3D flip transition between auth
> routes, Checkbox primitive patched for Tailwind 3 compatibility.
>
> Out of scope (deferred): post-signup onboarding wizard, dark-mode UI
> toggle, theme customization per workspace.

---

## 0. Pre-flight

- [ ] `docker compose ps` shows `wekala-web` and `wekala-api` healthy
- [ ] `pnpm lint` returns green
- [ ] `pnpm type-check` returns green
- [ ] `apps/web/components.json` exists with `"style": "radix-nova"`, `"baseColor": "neutral"`
- [ ] `apps/web/components/ui/` contains: alert, avatar, badge, button, card, checkbox, dialog, input, input-otp, label, separator, sheet, skeleton, tabs, tooltip
- [ ] `apps/web/lib/utils.ts` exports `cn()`
- [ ] `apps/web/app/globals.css` defines `--background`, `--foreground`, `--primary`, `--border`, `--radius` HSL tokens

## 1. shadcn primitives render

Open any existing app page that uses shadcn primitives (or the redesigned
auth pages from Phase 12 once tagged).

- [ ] `Button` (default variant) renders with `bg-primary text-primary-foreground`
- [ ] `Input` renders with `border-input`, focus ring is `ring-ring/50`
- [ ] `Checkbox` unchecked: white bg, grey border. **Checked: fully black bg, white check icon visible**
- [ ] `Alert variant="destructive"` renders with red border + red text
- [ ] `Tooltip` opens on hover after ~150ms

## 2. Design tokens (light only)

In Chrome DevTools → Elements → :root, verify computed values:

- [ ] `--background: 0 0% 100%`
- [ ] `--foreground: 0 0% 9%`
- [ ] `--primary: 240 5.9% 10%` (near-black)
- [ ] `--border: 240 5.9% 90%` (light grey)
- [ ] `--radius: 0.5rem`

`html` element has NO `dark` class set anywhere (light-only POC).

## 3. AuthShell layout

Visit `/login` (or any other `(auth)` route).

- [ ] Below `lg` breakpoint (< 1024px): only the white form panel shows; brand panel hidden
- [ ] At `lg` breakpoint and above: split layout — form on left, **black brand panel on right** at 2:3 ratio (`lg:grid-cols-2`)
- [ ] Brand panel header: fake browser chrome with 3 dots + `wekala.local` URL pill
- [ ] Brand panel background: subtle diagonal-line pattern at ~7% opacity

## 4. Interactive laptop mockup (brand panel)

Stay on any auth route. Watch the brand panel for 30 seconds.

- [ ] Showcase card cycles through 3 scenes every ~7s with smooth opacity cross-fade:
  - **Scene 1 — Bazaar grid** (4 agent cards staggered pulse-up animation)
  - **Scene 2 — Command Center** (3 KPI cards + 7 day bars that scale up from 0)
  - **Scene 3 — Agent Detail** (5 tabs, Vetting tab underlined with sweep animation, 3 vetting check rows)
- [ ] Below the card: title + subtitle text **sync to the active scene**
  (e.g. "Discover Pre-vetted Agents" → "See Real-time Impact" → "Vet Before You Deploy")
- [ ] Dot indicator at bottom: 3 dots, active is wide white pill, inactive are small grey
- [ ] **Click a dot** → scene jumps immediately to that index; auto-cycle resumes from there
- [ ] Chrome DevTools → Rendering → "Emulate CSS media feature `prefers-reduced-motion: reduce`":
  scenes still cross-fade (JS-driven) but card-pulse / bar-grow / tab-highlight intro animations stop

## 5. Flip transition between auth routes

Start on `/login`. Hard-refresh first so the brand panel mounts fresh.

- [ ] In Chrome DevTools → Components (React tab), expand the tree: `BrandPanel` is mounted with `active=0` (or whatever scene is current)
- [ ] Click "Create an account" (signup link) → URL goes to `/signup`
- [ ] **Form panel flips in** with a 500ms `rotateY(-90deg → 0deg)` + opacity fade (cubic-bezier easing)
- [ ] **Brand panel does NOT re-mount**: the scene state preserves — same dot stays active, no scene reset
- [ ] Click "Sign in" link in the signup footer → flips back to `/login` the same way
- [ ] Flip between `/login` ↔ `/reset-password` ↔ `/signup` works identically; brand panel survives all
- [ ] DevTools → Rendering → `prefers-reduced-motion: reduce` → transition becomes a 200ms opacity-only fade (no flip)

## 6. Checkbox Tailwind 3 fix

On `/login`, locate the "Remember me" checkbox. On `/signup`, locate the Terms checkbox.

- [ ] Click each checkbox → background fills **fully black** (`bg-primary` = neutral-950), **white check icon visible inside**
- [ ] Click again → returns to white background, grey border, no check
- [ ] DevTools → Elements: confirm the checked button has `data-state="checked"` and the computed `background-color` is `rgb(15, 15, 15)` (~neutral-950)

## 7. Storage helper consolidation

In DevTools → Application → Storage:

- [ ] Before login: both `localStorage` and `sessionStorage` empty for `access_token` / `refresh_token`
- [ ] Sign in **without** "Remember me" → `sessionStorage` has `access_token` + `refresh_token`; `localStorage` is empty for these keys
- [ ] Sign out → both storages cleared
- [ ] Sign in **with** "Remember me" → `localStorage` has `access_token` + `refresh_token` + `wekala_remember_me=1`; `sessionStorage` empty
- [ ] Close the tab + reopen `/dashboard` → still signed in
- [ ] Sign out → all three keys cleared from `localStorage`

## 8. Regression check — pre-Phase-11 pages

The brand panel only ships to `(auth)` routes; existing app pages
(Bazaar, Command Center, Agent Detail, etc.) should be unchanged.

- [ ] Sign in, navigate to `/dashboard` → renders as before, no brand panel
- [ ] `/bazaar` → cards render, no shadcn/Flynt restyling applied here yet
- [ ] `/workspaces/<id>/command-center` → KPIs + chart + audit log render as before
- [ ] No console errors related to missing shadcn primitives or Tailwind classes

---

## Acceptance

- [ ] All sections 1–8 checked
- [ ] No console errors on any auth route
- [ ] Lighthouse a11y on `/login` ≥ 90

Once all boxes are ticked, request tag `phase-11-complete`.
