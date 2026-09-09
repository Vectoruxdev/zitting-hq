-- Zitting HQ — Phase 2 of the 2026-09 revamp: the kitchen.
-- Dinner nights (rotation, per-night overrides, dish duty, swap requests),
-- meal ideas from links, recipe covers/metadata, grocery assignees.
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
-- RUN BEFORE DEPLOYING the Phase 2 code (reads degrade to empty until then).

-- The meals tables from supabase-meals.sql were never run in production —
-- included here so one script sets up the whole kitchen.
CREATE TABLE IF NOT EXISTS recipes (
  id serial PRIMARY KEY,
  name text NOT NULL,
  emoji text,
  ingredients jsonb NOT NULL DEFAULT '[]',
  notes text,
  last_made_on date,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meal_plan (
  id serial PRIMARY KEY,
  date date NOT NULL,
  slot text NOT NULL DEFAULT 'dinner',
  recipe_id integer REFERENCES recipes(id) ON DELETE SET NULL,
  title text,
  note text,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_slot ON meal_plan(date, slot);

-- Recipe metadata + cover photo (object key in the private 'recipes' bucket).
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cover_photo_path text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS servings integer;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_minutes integer;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS created_by text REFERENCES family_members(id) ON DELETE SET NULL;

-- Who cooks by default on each weekday (0 = Sunday … 6 = Saturday) and who is
-- on dishes. Null cook = nobody assigned (leftovers / eat out / open).
CREATE TABLE IF NOT EXISTS dinner_rotation (
  weekday         smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  cook_member_id  text REFERENCES family_members(id) ON DELETE SET NULL,
  dish_member_ids text[] NOT NULL DEFAULT '{}',
  updated_at      timestamptz DEFAULT now()
);

-- Per-date overrides (a swap, a one-off change, a note).
CREATE TABLE IF NOT EXISTS dinner_assignments (
  date            date PRIMARY KEY,
  cook_member_id  text REFERENCES family_members(id) ON DELETE SET NULL,
  dish_member_ids text[] NOT NULL DEFAULT '{}',
  note            text,
  source          text NOT NULL DEFAULT 'override',   -- override | swap
  updated_at      timestamptz DEFAULT now()
);

-- "Can you take tonight? I'll take your Wednesday." Accepting exchanges the
-- cooks on both dates (the planned meals stay with their dates).
CREATE TABLE IF NOT EXISTS dinner_swaps (
  id              serial PRIMARY KEY,
  from_member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  to_member_id    text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  from_date       date NOT NULL,   -- the requester's night they want covered
  to_date         date NOT NULL,   -- the night they offer to take in return
  status          text NOT NULL DEFAULT 'pending',    -- pending | accepted | declined | cancelled
  message         text,
  created_at      timestamptz DEFAULT now(),
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dinner_swaps_status ON dinner_swaps (status);

-- Meal ideas: a TikTok, an Instagram post, a recipe page. Reactions decide
-- what gets planned; "made it" turns an idea into a recipe.
CREATE TABLE IF NOT EXISTS meal_ideas (
  id          serial PRIMARY KEY,
  url         text NOT NULL,
  platform    text NOT NULL DEFAULT 'web',    -- tiktok | instagram | youtube | web
  title       text,
  image_url   text,
  author      text,
  notes       text,
  posted_by   text REFERENCES family_members(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'idea',   -- idea | planned | made
  recipe_id   integer REFERENCES recipes(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meal_idea_reactions (
  idea_id    integer NOT NULL REFERENCES meal_ideas(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  emoji      text NOT NULL DEFAULT 'heart',
  PRIMARY KEY (idea_id, member_id)
);

-- Grocery list: who's grabbing it, who asked for it.
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS assignee_member_id text REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS requested_by text REFERENCES family_members(id) ON DELETE SET NULL;

-- Private bucket for recipe covers (signed URLs).
INSERT INTO storage.buckets (id, name, public) VALUES ('recipes', 'recipes', false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE dinner_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE dinner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dinner_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_idea_reactions ENABLE ROW LEVEL SECURITY;
