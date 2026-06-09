-- =============================================================
-- Zitting Finance — one-time Plaid cleanup.
-- Run in Supabase → SQL Editor → Run.
--   1) adds the import_batches.source column (idempotent),
--   2) removes the manual/duplicate accounts now that Plaid auto-syncs
--      (keeps every account linked to a Plaid item; deletes the rest + data).
-- NOTE: this DELETES all non-Plaid accounts and their transactions. Run the
-- PREVIEW select first to confirm it lists only the accounts you expect.
-- =============================================================

-- 1) Tag column for import source (csv | plaid)
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'csv';

-- 2) PREVIEW — manual (non-Plaid) accounts that the cleanup below will remove.
--    Run this by itself first:
-- select id, name, institution from accounts
-- where id not in (select account_id from plaid_accounts where account_id is not null);

-- 3) CLEANUP — delete every non-Plaid account + its dependent rows.
begin;
  delete from transaction_splits where transaction_id in (
    select id from transactions
    where account_id not in (select account_id from plaid_accounts where account_id is not null));

  delete from transactions
    where account_id not in (select account_id from plaid_accounts where account_id is not null);

  delete from import_batches
    where account_id not in (select account_id from plaid_accounts where account_id is not null);

  delete from savings_contributions
    where account_id is not null
      and account_id not in (select account_id from plaid_accounts where account_id is not null);

  delete from account_members
    where account_id not in (select account_id from plaid_accounts where account_id is not null);

  delete from accounts
    where id not in (select account_id from plaid_accounts where account_id is not null);
commit;

-- 4) Verify (should return 0):
-- select count(*) from accounts
-- where id not in (select account_id from plaid_accounts where account_id is not null);
