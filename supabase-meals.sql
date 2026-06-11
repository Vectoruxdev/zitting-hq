-- Meals module: recipe box + week plan. Run AFTER supabase-groceries.sql
-- (send-to-shopping-list references shopping_items at the app layer only).
-- Run in the Supabase SQL Editor. Idempotent + additive only.

create table if not exists recipes (
  id serial primary key,
  name text not null,
  emoji text,
  ingredients jsonb not null default '[]',   -- [{ "name": "...", "qty": "..." }]
  notes text,
  last_made_on date,
  created_at timestamptz default now()
);

create table if not exists meal_plan (
  id serial primary key,
  date date not null,
  slot text not null default 'dinner',       -- breakfast | lunch | dinner
  recipe_id integer references recipes(id) on delete set null,
  title text,                                -- free text when no recipe
  note text,
  created_at timestamptz default now()
);
create unique index if not exists uq_meal_slot on meal_plan(date, slot);
