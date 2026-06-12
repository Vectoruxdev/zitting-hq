---
name: create-migration
description: Scaffold an additive Supabase schema change the Zitting HQ way — idempotent SQL file, Drizzle column, and a defensive read so a pre-migration database keeps working. Use when adding a column or table.
disable-model-invocation: true
---

# create-migration

Zitting HQ has no automatic migration runner. Jared applies SQL by hand in the
Supabase SQL Editor, and a deploy can go out **before** the SQL is run. So every
schema change must be **additive, idempotent, and read defensively** — the app
must keep working against a database that hasn't been migrated yet.

This skill scaffolds all four pieces in the house style. Follow it in order.

## Inputs to gather first

Ask (or infer from the request):
- **What's being added** — a column on an existing table, or a whole new table.
- **Table + column names**, types, defaults, FKs.
- A short **kebab-case name** for the migration (e.g. `celebrations`, `receipt-scan`).

## Step 1 — write the SQL file

Create `supabase-<name>.sql` in the repo root (sibling to the other
`supabase-*.sql` files). Rules:

- **Idempotent + additive only.** Never `drop`, never `alter ... type`, never
  rename. Use `add column if not exists`, `create table if not exists`,
  `create index if not exists`.
- New `not null` columns **must** have a `default` (existing rows need a value).
- Open with a one-line comment: what it does + "Run in the Supabase SQL Editor.
  Idempotent + additive only." Note any ordering dependency (e.g. "Run AFTER
  supabase-receipts.sql").

Column example:
```sql
-- <what this adds, one line>. Run in the Supabase SQL Editor. Idempotent + additive only.
alter table <table> add column if not exists <col> <type> not null default '<value>';
```

New-table example:
```sql
create table if not exists <table> (
  id serial primary key,
  <fk>_id uuid not null references <other>(id) on delete cascade,
  ...
);
create index if not exists idx_<table>_<fk> on <table>(<fk>_id);
```

## Step 2 — add the column/table to the Drizzle schema

Edit `src/db/schema.ts`. Add the column to the existing `pgTable` (or add a new
`pgTable`). Match the SQL exactly — same default, same nullability. Add a short
trailing comment pointing back at the SQL file, e.g.:
```ts
celebrationStyle: text("celebration_style").notNull().default("spicy"), // supabase-<name>.sql
```

## Step 3 — read it DEFENSIVELY in queries.ts

This is the step that's easy to forget and the reason a missed migration won't
wipe the dashboard. In `src/db/queries.ts`:

- For a **new column on `family_members`** (or another core table read with an
  explicit column list): add a **separate** `.select({...}).from(...).catch(() => [])`
  read for just the new column, then a `<field>ById` Map, defaulting when absent.
  Follow the existing `allowanceRows` / `lastSeenRows` / `celebrationRows`
  pattern exactly.
- For a **new feature table**: read it with `.catch(() => [] as ...[])`, like
  `goalRows`, `receiptLineRows`, etc.
- Core tables (accounts, members, categories, transactions) stay hard-failing —
  only the *new* read is defensive.

Then surface the field where it's consumed. If it belongs to a member, remember
the per-login privacy model: member-visible data rides on `memberHome`, and
`data.*` household sections are scrubbed by `memberScrub.ts`.

## Step 4 — seed the mock + verify

- Add the new field to the relevant object(s) in `src/finance/data/mockData.ts`
  so `/dev-preview` (which has no DB) still renders it.
- Run the gates: `pnpm exec tsc --noEmit && pnpm test`.

## Step 5 — hand off

Tell Jared, in one line, the exact file to run and any ordering:
> Run `supabase-<name>.sql` in the Supabase SQL Editor (after `supabase-<dep>.sql`).

Do **not** try to run it yourself — local dev has no database, and production SQL
is Jared's to apply.

## Reference: migrations already in the repo

`ls supabase-*.sql` — read a recent one (e.g. `supabase-celebrations.sql`,
`supabase-receipt-scan.sql`) to copy the exact tone and structure before writing
a new one.
