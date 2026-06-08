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
