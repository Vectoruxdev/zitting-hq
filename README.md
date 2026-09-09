# Family HQ

The Zitting household command center — a private hub for how the family runs.
**Finance** is the first module; Calendar, Tasks, and Meals are planned.

Live: https://zitting-hq.vercel.app

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** + a custom design system ("Premium Dark Fintech" — dark + light themes)
- **Supabase Postgres** + **Drizzle ORM** (with a mock-data fallback when no DB is configured)
- Deployed on **Vercel**

## Project layout

```
src/
├─ app/                 # Routes: / (hub), /finance (full-screen finance app)
├─ components/          # Hub chrome (site header)
├─ lib/modules.ts       # Module registry (Finance active; others planned)
├─ styles/tokens/       # Design-system CSS tokens (colors, type, spacing, themes)
├─ finance/             # Zitting Finance app
│  ├─ components/       # Design-system primitives (core / data / feedback)
│  ├─ screens/          # 15 finance screens (Overview, Transfers, Allocations, …)
│  ├─ data/mockData.ts  # Curated demo data (defaults / seed source)
│  ├─ ds.ts             # Component namespace
│  ├─ FinanceApp.tsx    # Client bootstrap + router
│  └─ FinanceClient.tsx # ssr:false wrapper
└─ db/                  # Drizzle schema, connection, queries, seed
```

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # production build
```

## Database (Supabase)

The app runs on curated mock data until a database is connected, then live rows
override it per-section. To connect:

1. Add Supabase to the Vercel project (Storage → Marketplace), or set
   `DATABASE_URL` / `DIRECT_URL` in `.env.local` (see `.env.example`).
2. Create tables and seed:

   ```bash
   pnpm db:push     # create tables from the Drizzle schema
   pnpm db:seed     # load the demo data
   pnpm db:studio   # browse the data (optional)
   ```

Connection env vars are flexible: `DATABASE_URL` or the Vercel→Supabase
`POSTGRES_URL` (pooled) are used at runtime; `DIRECT_URL` / `POSTGRES_URL_NON_POOLING`
(direct) for migrations.

## Revamp 2026-09 (family-first app)

The app is now a family hub — Home, Photos, Meals, Groceries, Calendar,
Appointments, Quotes, Goals, Trips, Chores — with Finance as one module inside
it. Design system lives in `src/ui` (tokens in `src/styles/zh`); the module
registry in `src/lib/modules.ts` drives every navigation surface.

**Migrations** are hand-written, idempotent SQL run in the Supabase SQL Editor
*before* deploying. Run in this order (each is safe to re-run):

1. `supabase-phase1-profiles-quotes.sql` — member profiles, notification prefs, quotes, shares
2. `supabase-phase2-kitchen.sql` — recipes/meal plan, dinner rotation + swaps, meal ideas
3. `supabase-phase3-photos.sql` — photo library (private `photos` bucket), albums, attachments
4. `supabase-phase4-calendar-trips.sql` — appointments, reminders, trips (private `documents` bucket)
5. `supabase-phase5-goals-chores.sql` — goals, check-ins, chores, completions
6. `supabase-phase6-money-v2.sql` — `account_members.access` (manage | view), per-member module switches

**Reminders** (appointments/events) are sent by `sendDueReminders()` in
`src/db/reminders.ts`: it ticks after every Home visit (at most once per five
minutes per server instance) and runs once a day inside the digest cron as a
backstop — Vercel Hobby only allows daily crons. `/api/reminders/cron`
(`CRON_SECRET` bearer) exists for an external 15-minute scheduler if you want
minute-level precision without anyone opening the app.

**Env vars** (names only): `MCP_READONLY_TOKEN` enables the read-only MCP tier
(`/api/mcp`) — set it to give agents a token that can't write.

**Permissions:** the owner sees everything; every shareable item carries a
`visibility` (family | private | custom + `shares`) checked by one predicate,
`canView` in `src/lib/access.ts`. Finance access is per account from
**People & permissions** (`/people`): *Manage* = in charge (categorize, approve),
*View* = balance + activity, read-only.

