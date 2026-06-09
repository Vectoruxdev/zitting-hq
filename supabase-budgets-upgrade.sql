-- =============================================================
-- Zitting Finance — budgets upgrade (migration 0004).
-- Links budgets to a person (allowance) or category so `spent` can be
-- derived from transactions. Safe to run anytime in Supabase → SQL Editor.
-- =============================================================
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS category_id text;
