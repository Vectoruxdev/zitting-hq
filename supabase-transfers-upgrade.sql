-- =============================================================
-- Zitting Finance — transfers engine upgrade (migration 0006).
-- Turns allocation_rules into the unified transfer-rule engine and adds the
-- real transfer_instances table (pending checklist + history). Safe to run
-- anytime in Supabase → SQL Editor → Run (idempotent).
-- =============================================================

-- allocation_rules → transfer-rule engine
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS from_account_id text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS to_account_id text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'on_income';
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS income_match text;

-- transfer_instances — pending checklist + history
CREATE TABLE IF NOT EXISTS transfer_instances (
  id serial PRIMARY KEY,
  rule_id text,
  from_account_id text,
  to_account_id text,
  member_id text,
  amount numeric(14,2) NOT NULL,
  method text,
  planned_date date,
  status text NOT NULL DEFAULT 'pending', -- pending | done | auto | skipped
  triggered_by text,                      -- manual | income:<txnId> | import:<batchId>
  trigger_income_txn_id integer,
  completed_txn_id integer,
  completed_at timestamp,
  note text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ti_status ON transfer_instances (status);
CREATE INDEX IF NOT EXISTS idx_ti_rule ON transfer_instances (rule_id);
CREATE INDEX IF NOT EXISTS idx_ti_income ON transfer_instances (trigger_income_txn_id);
CREATE INDEX IF NOT EXISTS idx_ti_accounts ON transfer_instances (from_account_id, to_account_id, status);
