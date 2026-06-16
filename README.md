# 🏃 Stepathon

> **Walk Together. Win Together.** — a mobile-first PWA for corporate/team walking competitions.

Teams compete by logging daily steps. Totals roll up automatically, leaderboards
update in real time, members earn badges, and a live activity feed keeps everyone
motivated. Built free-tier-friendly: **React + Vite + Tailwind + ShadCN** on the
front, **Supabase (Postgres + Auth + Realtime + Edge Functions)** on the back,
deployed to **Vercel**.

---

## Tech stack

| Layer        | Choice                                                        |
|--------------|--------------------------------------------------------------|
| UI           | React 18, TypeScript, Vite, TailwindCSS, ShadCN UI, Framer Motion |
| Data fetching| TanStack Query (server cache) + Supabase Realtime (push invalidation) |
| Forms        | React Hook Form + Zod                                        |
| Charts       | Recharts                                                     |
| Backend      | Supabase: Postgres, Row Level Security, Views, RPC, Edge Functions |
| Auth         | Supabase Auth → **Google OAuth only** (PKCE)                 |
| PWA          | vite-plugin-pwa (Workbox), Web Push (VAPID)                  |
| Hosting      | Vercel (frontend) + Supabase (managed backend)              |

## Documentation

- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — **start here to deploy.** Linear build→prod procedure with verification gates, rollback, and troubleshooting.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system & ER diagrams, API, components, gamification, notifications, PWA, wireframes, future work.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — reference setup (Supabase, Google OAuth, env vars, Vercel).

## Repository layout

```
stepathon/
├─ index.html
├─ vite.config.ts           # Vite + PWA (manifest, Workbox runtime caching)
├─ tailwind.config.ts       # design tokens (emerald/sky/amber fitness theme)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/           # 0001 schema · 0002 fns+views · 0003 RLS · 0004 seed
│  └─ functions/            # send-push, daily-reminder (Deno Edge Functions)
└─ src/
   ├─ main.tsx App.tsx      # entry + router (protected/admin routes)
   ├─ components/
   │  ├─ ui/                # ShadCN primitives (button, card, tabs, …)
   │  ├─ layout/            # AppLayout, BottomNavigation, ProtectedRoute
   │  ├─ common/            # StatCard, ProgressCard, BadgeCard, ActivityCard, CatchNextWidget
   │  ├─ leaderboard/       # LeaderboardCard
   │  └─ team/              # TeamMemberCard
   ├─ pages/                # Login, Home, UpdateSteps, Team, Leaderboard, Profile, Admin
   ├─ services/             # auth, event, team, step, leaderboard, badge, activity, notification, admin
   ├─ hooks/                # useAuth, useActiveEvent, useLeaderboard, useSteps, useRealtime, useConfetti
   ├─ lib/                  # supabase, queryClient, validation (zod), constants, format, utils
   └─ types/                # database.types.ts (generated), index.ts (domain types)
```

## Quick start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env        # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_VAPID_PUBLIC_KEY

# 3. Push the database schema (requires Supabase CLI + linked project)
supabase link --project-ref <ref>
supabase db push            # applies supabase/migrations/*

# 4. Run
npm run dev                 # http://localhost:5173
```

Full backend + OAuth + deploy steps live in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Scripts

| Script             | Purpose                                   |
|--------------------|-------------------------------------------|
| `npm run dev`      | Vite dev server                           |
| `npm run build`    | Type-check + production build             |
| `npm run preview`  | Preview the production build (test PWA)    |
| `npm run typecheck`| `tsc --noEmit`                            |
| `npm run db:push`  | Apply Supabase migrations                 |
| `npm run db:types` | Regenerate `src/types/database.types.ts`  |

## Core business flow

`Admin creates event → activates it (only one active at a time) → users sign in with
Google → create/join teams → submit daily steps (validated server-side via the
submit_steps RPC) → team & individual totals + ranks recompute → badges/activity/
notifications fire → admin closes event → winner = highest team total.`
