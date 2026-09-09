-- Zitting HQ — Phase 1 of the 2026-09 revamp: profiles, per-member settings,
-- per-member notification preferences, family quotes, per-item sharing.
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
-- RUN THIS BEFORE DEPLOYING the code that reads these (the code degrades to
-- empty/default state until it has run — nothing breaks either way).

-- Profile + settings per family member. Kept as its own table (not columns on
-- family_members) so existing `select *` reads keep working pre-migration.
CREATE TABLE IF NOT EXISTS member_profiles (
  member_id      text PRIMARY KEY REFERENCES family_members(id) ON DELETE CASCADE,
  kind           text NOT NULL DEFAULT 'adult',      -- adult | child (decides the Home variant; finance role stays on family_members)
  hue            smallint,                            -- 1..6 family hue for the avatar fallback (null = derived from id)
  avatar_path    text,                                -- object key in the private 'avatars' bucket
  birthday       date,
  greeting_name  text,                                -- "Good morning, <greeting_name>" (null = first name)
  theme          text NOT NULL DEFAULT 'system',      -- light | dark | system
  home_layout    jsonb,                               -- ordered section keys + hidden flags
  updated_at     timestamptz DEFAULT now()
);

-- Per member × event notification channels (replaces the global table for
-- members; missing rows = fully on, matching today's fail-open behaviour).
CREATE TABLE IF NOT EXISTS member_notification_prefs (
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  event      text NOT NULL,
  in_app     boolean NOT NULL DEFAULT true,
  push       boolean NOT NULL DEFAULT true,
  email      boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (member_id, event)
);

-- Family quotes — an heirloom, not a database.
CREATE TABLE IF NOT EXISTS quotes (
  id                 serial PRIMARY KEY,
  text               text NOT NULL,
  said_by_member_id  text REFERENCES family_members(id) ON DELETE SET NULL,
  said_by_name       text,                             -- free text when not a member (or a nickname)
  said_on            date,
  added_by           text REFERENCES family_members(id) ON DELETE SET NULL,
  visibility         text NOT NULL DEFAULT 'family',   -- family | private | custom (custom → rows in shares)
  favorite           boolean NOT NULL DEFAULT false,
  show_on_login      boolean NOT NULL DEFAULT false,   -- curated subset allowed on the pre-auth login page (no kids' names)
  source             text NOT NULL DEFAULT 'user',     -- user | seed
  created_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_login ON quotes (show_on_login) WHERE show_on_login;
CREATE INDEX IF NOT EXISTS idx_quotes_said_on ON quotes (said_on);

-- Per-item sharing for visibility = 'custom' (photos, albums, quotes, goals, events, trips).
CREATE TABLE IF NOT EXISTS shares (
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  member_id   text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_type, entity_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_member ON shares (member_id);

-- Notifications learn which module they belong to (the hub groups/filters on it).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS module text NOT NULL DEFAULT 'finance';

-- Private avatar bucket (signed URLs from the server, like receipts).
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', false) ON CONFLICT (id) DO NOTHING;

-- Deny-by-default RLS like every other public table (the app uses the direct
-- postgres connection, which bypasses RLS).
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Starter quotes for the login page: public-domain lines about home, marked
-- show_on_login so the pre-auth page has something to say before the family's
-- own quotes exist. Replace or unflag freely; the family's quotes stay behind
-- the login regardless. Idempotent by text.
INSERT INTO quotes (text, said_by_name, visibility, show_on_login, source)
SELECT v.text, v.who, 'family', true, 'seed'
FROM (VALUES
  ('Home is the place where, when you have to go there, they have to take you in.', 'Robert Frost'),
  ('There is no place like home.', 'L. Frank Baum'),
  ('The ornament of a house is the friends who frequent it.', 'Ralph Waldo Emerson'),
  ('Where we love is home — home that our feet may leave, but not our hearts.', 'Oliver Wendell Holmes Sr.'),
  ('A house is made of walls and beams; a home is built with love and dreams.', 'Proverb'),
  ('Be it ever so humble, there is no place like home.', 'John Howard Payne'),
  ('It takes hands to build a house, but only hearts can build a home.', 'Proverb'),
  ('Other things may change us, but we start and end with the family.', 'Anthony Brandt')
) AS v(text, who)
WHERE NOT EXISTS (SELECT 1 FROM quotes q WHERE q.text = v.text);
