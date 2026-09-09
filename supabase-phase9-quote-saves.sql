-- Zitting HQ — per-person saved quotes (2026-09-09). A quote someone likes goes
-- into their own Saved list on the Quotes page. Idempotent; additive.
CREATE TABLE IF NOT EXISTS quote_saves (
  quote_id   integer NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (quote_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_quote_saves_member ON quote_saves (member_id, created_at DESC);
ALTER TABLE quote_saves ENABLE ROW LEVEL SECURITY;
