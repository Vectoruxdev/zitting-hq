-- =============================================================
-- Zitting Finance — remove duplicate transactions + prevent recurrence.
-- 1) Deletes exact-duplicate rows (same account_id + dedupe_hash), keeping the
--    earliest. These are ingestion dups (e.g. two syncs racing on one Plaid
--    transaction) — NOT legitimate same-day/same-amount repeats (those have
--    different dedupe hashes and are untouched).
-- 2) Adds a UNIQUE index so the database itself rejects future dup inserts
--    (works with the app's onConflictDoNothing). Idempotent — safe to re-run.
-- Run in Supabase → SQL Editor.
-- =============================================================

begin;
  -- remove split rows belonging to the duplicates first (FK)
  DELETE FROM transaction_splits WHERE transaction_id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY account_id, dedupe_hash ORDER BY id) AS rn
      FROM transactions WHERE dedupe_hash IS NOT NULL
    ) d WHERE d.rn > 1
  );
  DELETE FROM transactions WHERE id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY account_id, dedupe_hash ORDER BY id) AS rn
      FROM transactions WHERE dedupe_hash IS NOT NULL
    ) d WHERE d.rn > 1
  );
commit;

-- DB-level guard against future exact dups (partial: only keyed rows).
CREATE UNIQUE INDEX IF NOT EXISTS uq_txn_account_dedupe
  ON transactions (account_id, dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;
