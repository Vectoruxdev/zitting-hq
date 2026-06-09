-- Zitting Finance — Plaid automatic bank sync (migration 0008).
-- Idempotent: safe to run anytime in Supabase → SQL Editor → Run.
-- New tables only — no changes to accounts/transactions, so this can't affect
-- existing data. Plaid transactions dedupe through the existing
-- transactions.dedupe_hash (externalId = Plaid transaction_id).

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
