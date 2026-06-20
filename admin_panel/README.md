# Sila — Admin Panel (team work area)

A **self-contained** front-end (Vite + React + TypeScript + Tailwind) that runs
on its own — **no Docker, no backend**. You build screens against mock data
here, and the platform owner ports them into the main Sila app later. Because
everyone keeps to the same folder, data shapes, and conventions, that port is
mechanical.

---

## Run it (no Docker, no WSL)

```bash
cd admin_panel
pnpm install      # or: npm install
pnpm dev          # opens http://localhost:5180
```

`src/App.tsx` renders and hot-reloads as you edit.

> **Port already in use?** Vite will fall back to `5181`, `5182`, … if a stale
> dev server is still holding `5180`. To reclaim it, kill the orphaned process:
> ```bash
> # Windows (PowerShell)
> Get-CimInstance Win32_Process -Filter "name='node.exe'" |
>   Where-Object { $_.CommandLine -like '*vite*' } |
>   ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
> ```

---

## How the app is wired

`App.tsx` is the shell. For now it renders **one page at a time** (swap the
import to view your screen). When more screens land, the owner adds routing —
keep each page self-contained so that stays easy.

```
admin_panel/
├── src/
│   ├── App.tsx          # the shell — wire your screen in here
│   ├── pages/           # one file per screen  (ReportsPage, AuditLogPage, …)
│   ├── components/      # reusable UI you build (StatusBadge, StatCard, …)
│   ├── hooks/           # React hooks          (useReports, useTypewriter, …)
│   ├── utils/           # pure helpers         (format, audit filtering, …)
│   ├── types/api.ts     # REAL backend shapes  (reference — do NOT rename)
│   ├── mock/data.ts     # mock data — BUILD AGAINST THIS first
│   └── lib/             # api.ts + endpoints.ts — added when wiring the live API
└── README.md            # this file
```

**Where new code goes**
- A screen → `src/pages/<Name>Page.tsx`.
- UI used by more than one screen → `src/components/`.
- Stateful logic / side effects → `src/hooks/use<Name>.ts`.
- Pure functions (formatting, filtering) → `src/utils/`.

Keep components small and presentational; push state into a hook and pure logic
into a util so it's testable and reusable.

---

## The workflow (one task = one branch = one PR)

1. **Branch off `main`:** `git checkout -b feature/admin-<your-name>-<task>`
2. Build your screen against `src/mock/data.ts`.
3. **Make the gate pass:** `pnpm typecheck` **and** `pnpm build` must succeed.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org)
   (`feat(admin): members table`, `fix(admin): …`, `docs: …`).
5. Push and open a **PR into `main`** for review. **Never push to `main`.**

> **Standalone scaffold note.** This package builds as its own pnpm workspace
> via `pnpm-workspace.yaml`, which approves the `esbuild` build script
> (`allowBuilds: { esbuild: true }`). Without that, `pnpm install` exits
> non-zero and `pnpm typecheck` fails. The file plus `pnpm-lock.yaml` are part
> of the standalone setup — if your branch is missing them, add them. (They're
> identical across branches, so expect a trivial add/add conflict until they're
> committed to `main` once.)

---

## Hard rules (so it integrates cleanly)

- **Only edit files inside `admin_panel/`.** Never touch the rest of the repo.
- **Build against `src/mock/data.ts`** — don't block on a live backend. You may
  *append* rows to the mock arrays, but **don't change field names** anywhere.
- **Don't rename fields in `src/types/api.ts`** — they map 1:1 to the real API,
  which is what makes integration a copy-paste.
- No `dangerouslySetInnerHTML`; let React escape user-supplied strings.

### Naming
- Files: kebab-case (`audit-table.tsx`) — except React components, which are
  PascalCase (`AuditTable.tsx`).
- Components: PascalCase. Hooks: `useThing`. Utils: camelCase functions.

---

## Screens (living index)

Each screen is its own page + PR. Add a row when you start one.

| Task | Screen | Key files | Status |
|------|--------|-----------|--------|
| AD3  | Agent report detail + resolve/dismiss | `pages/ReportsPage`, `components/ReportDetail`, `components/StatusBadge`, `hooks/useReports` | PR |
| AD5  | Audit-log viewer (search/filter)       | `pages/AuditLogPage`, `components/AuditFilters`, `components/AuditTable`, `utils/audit` | PR |
| AD6  | Admin dashboard cards                  | `pages/DashboardPage`, `components/StatCard` | PR |
| V3   | Voice tap-to-talk + orb states (mock)  | `pages/VoicePage`, `components/VoiceOrb`, `components/MicButton`, `hooks/useVoiceSession` | PR |
| S3   | SILA typewriter caption + action trail | `pages/SilaPage`, `components/TypewriterCaption`, `components/ActionTrail`, `hooks/useTypewriter` | PR |
| L6   | Arabic font (`ar` locale)              | `index.css`, `components/LocaleToggle`, `tailwind.config.js` | PR |

Shared helpers worth reusing: `utils/format.ts` (`formatDateTime`),
`components/StatusBadge`, `components/StatCard`.

---

## Connecting to the real backend (later)

When the team lead gives you a backend URL + a login:
1. copy `.env.example` → `.env`, set `VITE_API_URL`,
2. swap a screen's `import … from "@/mock/data"` for an `apiGet(ENDPOINTS.…, token)`
   call against `src/lib/`.

The shapes already match, so it's a small change per screen.

## Integration (done by the platform owner, not you)

Finished screens get ported into the main Next.js app
(`apps/web/app/(app)/admin/`), reusing the production API client. Because you
kept to these types and this folder, that port is mechanical.
