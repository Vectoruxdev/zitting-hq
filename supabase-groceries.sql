-- Groceries module: shared shopping list + pantry levels.
-- Run in the Supabase SQL Editor. Idempotent + additive only.

create table if not exists shopping_items (
  id serial primary key,
  name text not null,
  note text,                                -- qty / brand, e.g. "2 gal"
  category text not null default 'other',   -- produce | dairy | meat | pantry | frozen | household | other
  added_by text references family_members(id),
  checked boolean not null default false,
  source text not null default 'manual',    -- manual | meal | pantry
  created_at timestamptz default now(),
  checked_at timestamptz,
  archived_at timestamptz
);
create index if not exists idx_shopping_active on shopping_items(archived_at, checked);

create table if not exists pantry_items (
  id serial primary key,
  name text not null,
  category text not null default 'other',
  level text not null default 'ok',          -- ok | low | out
  staple boolean not null default false,
  updated_at timestamptz default now()
);
create index if not exists idx_pantry_level on pantry_items(level);
