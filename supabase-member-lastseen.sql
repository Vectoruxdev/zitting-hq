-- =============================================================
-- Zitting Finance — member last-seen (migration 0013).
-- Records the last time each member opened the app, so People & Access can show
-- "Active · 2h ago" and reflect that someone has signed in. Idempotent.
-- Run in Supabase → SQL Editor.
-- =============================================================

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS last_seen_at timestamp;
