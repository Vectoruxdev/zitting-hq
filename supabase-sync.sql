-- =============================================================
-- Zitting Finance — full schema sync (idempotent).
-- Safe to run anytime in Supabase → SQL Editor → Run. Brings the database up
-- to the current code schema (migrations 0001 + 0002 + 0003 + 0004) without
-- errors, whether or not parts were already applied.
-- =============================================================

-- ---- Categories (0001) ----
CREATE TABLE IF NOT EXISTS category_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  group_id text,
  color text NOT NULL DEFAULT 'var(--gray-500)',
  icon text,
  kind text NOT NULL DEFAULT 'expense',
  exclude_from_budget boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

-- ---- Import + splits + rules + templates (0001) ----
CREATE TABLE IF NOT EXISTS import_batches (
  id text PRIMARY KEY,
  account_id text,
  filename text,
  rows_total integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  created_by text,
  undone_at timestamp
);
CREATE TABLE IF NOT EXISTS transaction_splits (
  id serial PRIMARY KEY,
  transaction_id integer NOT NULL,
  category_id text,
  amount numeric(14,2) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categorization_rules (
  id serial PRIMARY KEY,
  match_type text NOT NULL DEFAULT 'contains',
  match_value text NOT NULL,
  field text NOT NULL DEFAULT 'merchant',
  category_id text,
  member text,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS column_mapping_templates (
  id serial PRIMARY KEY,
  account_id text,
  bank text,
  name text NOT NULL,
  mapping jsonb NOT NULL,
  created_at timestamp DEFAULT now()
);

-- ---- Learned merchant memory (0002) ----
CREATE TABLE IF NOT EXISTS merchant_memory (
  id serial PRIMARY KEY,
  merchant_key text NOT NULL,
  category_id text,
  member text,
  count integer NOT NULL DEFAULT 1,
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchant_memory_key ON merchant_memory (merchant_key);

-- ---- transactions: new columns (0001) ----
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "date" date;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_batch_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_transfer boolean NOT NULL DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_pair_id integer;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dedupe_hash text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_split boolean NOT NULL DEFAULT false;
-- transactions: review metadata (0002)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_source text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_confidence numeric(4,3);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false;
-- transactions: legacy label columns become optional
ALTER TABLE transactions ALTER COLUMN date_label DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN category DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN account_label DROP NOT NULL;
ALTER TABLE transactions ALTER COLUMN who DROP NOT NULL;

-- ---- transactions indexes (0001) ----
CREATE INDEX IF NOT EXISTS idx_txn_account ON transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_txn_category ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_txn_member ON transactions (member_id);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions ("date");
CREATE INDEX IF NOT EXISTS idx_txn_batch ON transactions (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_txn_dedupe ON transactions (account_id, dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_splits_txn ON transaction_splits (transaction_id);
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON categorization_rules (enabled, priority);

-- ---- family_members: people + login columns (0003) ----
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS auth_id text;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'none';
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS color text;

-- ---- budgets: link to a person (allowance) or category (0004) ----
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS category_id text;

-- ---- member-managed accounts + allowance (0005) ----
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS allowance numeric(14,2);
CREATE TABLE IF NOT EXISTS account_members (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_acctmem_member ON account_members (member_id);

-- ---- transfers engine: allocation_rules columns + transfer_instances (0006) ----
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS from_account_id text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS to_account_id text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS member_id text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'on_income';
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS income_match text;
-- scheduled (time-based) transfer rules (0007)
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS cadence text;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS anchor_date date;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS next_run_date date;
ALTER TABLE allocation_rules ADD COLUMN IF NOT EXISTS last_run_date date;
CREATE TABLE IF NOT EXISTS transfer_instances (
  id serial PRIMARY KEY,
  rule_id text,
  from_account_id text,
  to_account_id text,
  member_id text,
  amount numeric(14,2) NOT NULL,
  method text,
  planned_date date,
  status text NOT NULL DEFAULT 'pending',
  triggered_by text,
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

-- ---- savings goals: ledger + visibility + metadata (0007) ----
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS account_id text;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS auto_contrib numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'var(--accent)';
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'custom';
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'household';
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS archived_at timestamp;
CREATE TABLE IF NOT EXISTS savings_goal_members (
  id serial PRIMARY KEY,
  goal_id text NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_goal_members_goal ON savings_goal_members (goal_id);
CREATE TABLE IF NOT EXISTS savings_contributions (
  id serial PRIMARY KEY,
  goal_id text NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  "date" date,
  kind text NOT NULL DEFAULT 'manual',
  member_id text REFERENCES family_members(id),
  account_id text REFERENCES accounts(id),
  note text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contrib_goal ON savings_contributions (goal_id);

-- ---- Plaid automatic bank sync (0008) ----
CREATE TABLE IF NOT EXISTS plaid_items (
  id text PRIMARY KEY,
  item_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  institution_id text,
  institution_name text,
  cursor text,
  status text NOT NULL DEFAULT 'good',
  error text,
  created_by text,
  created_at timestamp DEFAULT now(),
  last_synced_at timestamp
);
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id serial PRIMARY KEY,
  item_id text NOT NULL,
  plaid_account_id text NOT NULL UNIQUE,
  account_id text REFERENCES accounts(id),
  name text,
  mask text,
  type text,
  subtype text,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plaid_acct_item ON plaid_accounts (item_id);

-- ---- import_batches: tag source csv|plaid (0009) ----
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'csv';

-- ---- notifications: recipient routing + timestamps + dedup (0010) ----
CREATE TABLE IF NOT EXISTS notifications (
  id serial PRIMARY KEY,
  type text NOT NULL,
  icon text,
  tone text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  time_label text,
  unread boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS audience   text NOT NULL DEFAULT 'owners';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS member_id  text REFERENCES family_members(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_to    text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_notif_member ON notifications (member_id);
CREATE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications (dedupe_key);

-- ---- web push subscriptions (0011) ----
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

-- ---- notification preferences (0012) ----
CREATE TABLE IF NOT EXISTS notification_prefs (
  event text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  in_app boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  updated_at timestamp DEFAULT now()
);

-- ---- Email digests (0012) ----
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS digest_opt_in boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS digest_settings (
  id text PRIMARY KEY DEFAULT 'household',
  cadence text NOT NULL DEFAULT 'monthly', -- weekly | biweekly | monthly
  enabled boolean NOT NULL DEFAULT true,
  owner_enabled boolean NOT NULL DEFAULT true,
  members_enabled boolean NOT NULL DEFAULT true,
  anchor_date date,
  next_run_date date,
  last_run_date date,
  updated_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS digest_log (
  id serial PRIMARY KEY,
  recipient_email text NOT NULL,
  kind text NOT NULL,            -- owner | member
  member_id text,
  period_key text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_digestlog_period ON digest_log (recipient_email, period_key, kind);

-- ---- member last-seen (0013) ----
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS last_seen_at timestamp;

-- ---- account space: household vs business (0014) ----
-- "business" accounts are hidden from the household dashboard + emails and
-- skipped by Plaid sync (seam for a future Business tab).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS space text NOT NULL DEFAULT 'household';
