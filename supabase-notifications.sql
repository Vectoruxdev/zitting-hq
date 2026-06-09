-- =============================================================
-- Zitting Finance — notifications upgrade (migration 0010).
-- Adds recipient routing + real timestamps + dedup to the existing
-- notifications table so Plaid sync (and member nudges) can write
-- targeted, time-stamped, idempotent in-app alerts.
-- Run in Supabase → SQL Editor → Run BEFORE deploying the code that
-- reads these columns. Fully idempotent.
-- =============================================================

-- Base table (no-op if it already exists from the initial migration).
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  type text NOT NULL,
  icon text,
  tone text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  time_label text,
  unread boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

-- New columns (additive, safe to re-run).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience   text NOT NULL DEFAULT 'owners';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS member_id  text REFERENCES family_members(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_to    text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notif_member ON notifications (member_id);
CREATE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications (dedupe_key);
