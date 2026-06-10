-- Migration 0006: per-account AVAILABLE balance snapshot.
-- The card's primary number is the CURRENT balance (opening + txn net); this
-- column carries the bank's point-in-time AVAILABLE balance (spendable after
-- pending holds) captured on each Plaid sync, shown as a secondary figure.
-- Idempotent — safe to run repeatedly. Run on live Supabase BEFORE deploying
-- the code that reads/writes it.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS available_balance numeric(14,2);
