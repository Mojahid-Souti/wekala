# Sila — Admin Panel (team work area)

A **self-contained** admin panel. It runs on its own (Vite + React + TypeScript
+ Tailwind), with **no Docker and no backend required** — build against the mock
data, and it gets integrated into the main Sila app later.

## Run it (no Docker, no WSL)

```bash
cd admin_panel
pnpm install      # or: npm install
pnpm dev          # opens http://localhost:5180
```

That's it — `src/App.tsx` renders and hot-reloads as you edit.

## Where everything goes (work ONLY inside admin_panel/)

```
admin_panel/
├── src/
│   ├── App.tsx          # the shell — wire your screens in here
│   ├── pages/           # one folder/file per screen (members, audit, reports…)
│   ├── components/      # reusable UI you build
│   ├── hooks/           # React hooks
│   ├── lib/
│   │   ├── api.ts       # fetch wrapper for the LIVE backend (use later)
│   │   └── endpoints.ts # the REAL backend routes (reference)
│   ├── types/api.ts     # the REAL backend data shapes (reference)
│   ├── utils/           # helpers
│   └── mock/data.ts     # mock data — BUILD AGAINST THIS first
```

## Rules (so it integrates cleanly later)

- **Only edit files inside `admin_panel/`.** Never touch the rest of the repo.
- **Build against `src/mock/data.ts`** — don't block on a live backend.
- **Don't change field names in `src/types/api.ts`** — they match the real API,
  which is what makes integration a copy-paste.
- **Each person: own branch → Pull Request → review.** No direct pushes to `main`.
- Keep it simple and readable; small components; Conventional Commits
  (`feat(admin): members table`).

## Connecting to the real backend (optional, later)

When your team lead gives you a backend URL + a login:
1. copy `.env.example` → `.env`, set `VITE_API_URL` to that URL,
2. swap a screen's `import … from "@/mock/data"` for `apiGet(ENDPOINTS.…, token)`.

The shapes already match, so it's a small change per screen.

## Integration (done by the platform owner, not you)

Your finished screens get ported into the main Next.js app
(`apps/web/app/(app)/admin/`), reusing the production API client. Because you
kept to these types and this folder, that port is mechanical.
