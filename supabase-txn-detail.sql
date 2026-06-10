-- =============================================================
-- Zitting Finance — transaction detail + categorizer attribution.
-- Two related additions, both idempotent. Run in Supabase → SQL Editor.
--
--   1. `description` — the full raw bank text (e.g. "NETFLIX.COM 866-579-7172
--      CA") kept alongside the cleaned `merchant` ("Netflix"). Surfaced in the
--      transaction detail drawer so people can identify ambiguous charges when
--      categorizing. Populated on Plaid sync when richer than the merchant name.
--   2. `categorized_by` / `categorized_at` — who deliberately set/changed the
--      category, and when. Set only on a manual categorize (single, bulk, or
--      merchant-group); auto-categorization leaves them null.
-- =============================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS categorized_by text REFERENCES family_members(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS categorized_at timestamp;
