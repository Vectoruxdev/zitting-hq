-- =============================================================
-- Zitting Finance — notification preferences (migration 0012).
-- Per-event toggles for which alerts fire and on which channel (in-app / push).
-- Missing rows default to fully on, so notifications keep working before this
-- runs. Idempotent — safe to re-run. Run in Supabase → SQL Editor.
-- =============================================================

CREATE TABLE IF NOT EXISTS notification_prefs (
  event text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  in_app boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  updated_at timestamp DEFAULT now()
);
