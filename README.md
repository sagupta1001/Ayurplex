# Ayurplex

Smart adaptive medication reminders. A React + Vite PWA (wrapped with Capacitor for iOS/Android) backed by Supabase. The scheduling engine is deterministic and rule-based — no LLM for safety-critical decisions.

> **Design source of truth:** [Priya Jaiswal's Ayurplex Behance project](https://www.behance.net/gallery/232160019/Ayurplex-Smart-AI-Medication-Reminders)
>
> **Spec:** [`docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md`](docs/superpowers/specs/2026-04-11-ayurplex-mvp-design.md)
>
> **Current state:** Plan 1 — Foundation. Monorepo skeleton only. No auth, no feature code yet.

## Prerequisites

- **Node.js 20** (see `.nvmrc`)
- **pnpm 9+** — `npm i -g pnpm`
- **Docker Desktop** — required by Supabase CLI local stack
- **Supabase CLI** — `brew install supabase/tap/supabase`

## Quickstart

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase URL + anon key after `supabase start`
pnpm --filter @ayurplex/web dev
```

Open http://localhost:5173 — you should see a "Hello Ayurplex" screen in Priya's forest green.

## Common tasks

```bash
pnpm build            # build all workspaces
pnpm test             # run Vitest unit + component tests
pnpm typecheck        # run tsc across the monorepo
pnpm lint             # ESLint, zero warnings allowed
pnpm format           # Prettier write

pnpm --filter @ayurplex/web test:e2e   # Playwright smoke test (requires dev server)
```

## Supabase local dev

```bash
supabase start        # launches Postgres (54322), API (54321), Studio (54323)
supabase status       # prints the anon key to paste into .env.local
supabase db reset     # re-applies migrations from supabase/migrations
supabase stop
```

## Project structure

```
ayurplex/
├── apps/
│   └── web/              # React + Vite PWA (the main client)
├── packages/
│   ├── shared/           # Shared domain types (grows with plans)
│   └── ui/               # Design tokens (Priya's palette + fonts)
├── supabase/
│   ├── config.toml
│   ├── migrations/       # Versioned SQL migrations
│   └── seed.sql
├── docs/
│   └── superpowers/
│       ├── specs/        # Design specifications
│       └── plans/        # Implementation plans (this plan lives here)
├── .github/workflows/    # CI
├── turbo.json
└── pnpm-workspace.yaml
```

## What's NOT in Plan 1

- Google OAuth / Supabase Auth wiring
- Medication / schedule / prescription tables and RLS policies
- Edge Functions (prescription parsing, reminder scheduling)
- Native iOS / Android Capacitor projects (generated in a later plan)

These land in subsequent plans — see `docs/superpowers/plans/`.

## License

Proprietary — all rights reserved (TBD for OSS release).
