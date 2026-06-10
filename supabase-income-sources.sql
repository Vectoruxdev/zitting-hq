-- Zitting Finance — curated income registry (migration 0009).
-- The single source of truth for "what counts as income": mark a payer (by
-- merchant key) and all its deposits count; only marked sources drive the
-- transfer-coverage forecast + allowance paychecks. Idempotent; run BEFORE deploy.
CREATE TABLE IF NOT EXISTS income_sources (
  id         text PRIMARY KEY,
  match_key  text NOT NULL,                       -- extractMerchant key identifying the payer
  name       text NOT NULL,
  member_id  text REFERENCES family_members(id),  -- whose income; null = household
  account_id text REFERENCES accounts(id),         -- deposit account (coverage matching)
  active     boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_income_sources_key ON income_sources (match_key);
