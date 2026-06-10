-- =============================================================
-- Zitting Finance — Web Push subscriptions (migration 0011).
-- Stores one row per device/browser push subscription so notifications
-- can fan out to the right people's phones. Run in Supabase → SQL Editor
-- BEFORE deploying the push code. Fully idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id serial PRIMARY KEY,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  member_id text REFERENCES family_members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  user_email text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_member ON push_subscriptions (member_id);
