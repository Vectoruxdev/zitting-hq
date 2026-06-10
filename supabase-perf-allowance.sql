-- Zitting Finance — performance-based allowances (migration 0007).
-- Idempotent: safe to run multiple times in the Supabase SQL Editor.
-- RUN THIS BEFORE DEPLOYING the code that reads these tables.

-- An earner's allowance rule: income goal + minimum floor + a bonus (fixed $ or
-- % of the overage / whole income) when paychecks beat the goal. Firing a rule
-- emits suggested transfers into transfer_instances that auto-complete from Plaid.
CREATE TABLE IF NOT EXISTS allowance_rules (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  member_id             text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  enabled               boolean NOT NULL DEFAULT true,
  period                text NOT NULL DEFAULT 'monthly',   -- monthly | per_paycheck
  goal_amount           numeric(14,2) NOT NULL,
  min_amount            numeric(14,2) NOT NULL DEFAULT 0,
  bonus_type            text NOT NULL DEFAULT 'percent',   -- percent | fixed
  bonus_basis           text NOT NULL DEFAULT 'overage',   -- overage | gross (ignored when fixed)
  bonus_value           numeric(14,2) NOT NULL DEFAULT 0,
  income_match_keys     jsonb,                             -- null = all income tagged to the earner
  from_account_id       text NOT NULL REFERENCES accounts(id),
  to_account_id         text NOT NULL REFERENCES accounts(id),
  gate_on_review        boolean NOT NULL DEFAULT true,
  last_processed_period text,
  created_at            timestamp DEFAULT now(),
  sort_order            integer NOT NULL DEFAULT 0
);

-- Bonus recipients for a rule (the earner is the implicit remainder = 100 - sum(pct)).
CREATE TABLE IF NOT EXISTS allowance_splits (
  id            serial PRIMARY KEY,
  rule_id       text NOT NULL REFERENCES allowance_rules(id) ON DELETE CASCADE,
  member_id     text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  pct           numeric(5,2) NOT NULL,
  to_account_id text NOT NULL REFERENCES accounts(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_allowance_split ON allowance_splits (rule_id, member_id);
CREATE INDEX IF NOT EXISTS idx_allowance_splits_rule ON allowance_splits (rule_id);
