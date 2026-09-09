-- Zitting HQ — per-person Google Calendar feeds (2026-09-09).
-- A feed now belongs to a person (NULL = a household feed added by the owner)
-- and carries a visibility: family | private | custom (shares.entity_type =
-- 'calendar_feed'). Idempotent; additive.
ALTER TABLE calendar_feeds ADD COLUMN IF NOT EXISTS member_id text REFERENCES family_members(id) ON DELETE CASCADE;
ALTER TABLE calendar_feeds ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'family';
ALTER TABLE calendar_feeds ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_calendar_feeds_member ON calendar_feeds (member_id);
