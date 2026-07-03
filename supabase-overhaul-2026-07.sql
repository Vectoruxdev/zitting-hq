-- =============================================================
-- Zitting HQ — July 2026 overhaul migration (run in Supabase → SQL Editor).
-- Idempotent — safe to re-run. Sections:
--   1) DB-level dedupe protection + removal of 4 known exact-dup rows
--   2) Merge the duplicate Visa: "Jared's Visa Credit Card" (manual CSV,
--      3ba3ba9f…) into "VISA PLATINUM" (Plaid, e7cf01fe…).
--      121 rows (ids 700–820) duplicate Plaid rows → deleted;
--      40 rows (ids 821–860, Feb 12 – Mar 10 history Plaid never backfilled)
--      → MOVED to VISA PLATINUM; the manual account is then deleted.
--   3) notifications.dedupe_key uniqueness (kills double-alert race)
--   4) transfer_instances: covered-period key + idempotency indexes
--   5) income_sources: gross-pay fields for the tithing engine + aliases
--   6) finance_settings: tithing/charity rates + default gross ratio
--   7) accounts.role (main/bills/budget/charity/personal) + seeds
--   8) giving_commitments (recurring donations: foundation, lights, building)
--   9) receipt_lines.canonical_name (item search)
--  10) plaid_items.syncing_at (sync lock)
-- After running: tell Claude — a final merchant-memory rebuild and
-- auto_link_transfers pass should run once this completes.
-- =============================================================

-- ---------- 1) exact-dup cleanup + unique guard --------------------------
begin;
  -- Known same-account exact duplicates (kept the earlier id of each pair):
  -- 1194/1193 Hildale Events, 1184/1183 Amazon, 1657/1656 Creek Valley,
  -- 1462/1460 Amazon Prime Video.
  UPDATE transfer_instances SET completed_txn_id = 1193 WHERE completed_txn_id = 1194;
  UPDATE transfer_instances SET completed_txn_id = 1183 WHERE completed_txn_id = 1184;
  UPDATE transfer_instances SET completed_txn_id = 1656 WHERE completed_txn_id = 1657;
  UPDATE transfer_instances SET completed_txn_id = 1460 WHERE completed_txn_id = 1462;
  UPDATE receipts SET transaction_id = 1193 WHERE transaction_id = 1194;
  UPDATE receipts SET transaction_id = 1183 WHERE transaction_id = 1184;
  UPDATE receipts SET transaction_id = 1656 WHERE transaction_id = 1657;
  UPDATE receipts SET transaction_id = 1460 WHERE transaction_id = 1462;
  UPDATE receipts SET suggested_transaction_id = NULL WHERE suggested_transaction_id IN (1194, 1184, 1657, 1462);
  UPDATE transactions SET transfer_pair_id = NULL WHERE transfer_pair_id IN (1194, 1184, 1657, 1462);
  DELETE FROM transaction_splits WHERE transaction_id IN (1194, 1184, 1657, 1462);
  DELETE FROM transactions WHERE id IN (1194, 1184, 1657, 1462);
commit;

-- Reject future exact dups at the DB level (works with onConflictDoNothing).
-- (Same index as supabase-dedupe-transactions.sql — included here so one run
-- covers it. Dups must be gone first, hence the deletes above.)
DO $$
BEGIN
  -- remove any remaining exact ingestion dups before creating the index
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
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_txn_account_dedupe
  ON transactions (account_id, dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;

-- ---------- 2) Visa merge -------------------------------------------------
begin;
  -- 2a. The 121 duplicate rows (ids 700–820) mirror Plaid rows on VISA
  --     PLATINUM. Repoint anything referencing them, then delete.
  UPDATE transfer_instances ti SET completed_txn_id = NULL
   WHERE ti.completed_txn_id BETWEEN 700 AND 820;
  UPDATE receipts SET transaction_id = NULL WHERE transaction_id BETWEEN 700 AND 820;
  UPDATE receipts SET suggested_transaction_id = NULL WHERE suggested_transaction_id BETWEEN 700 AND 820;
  UPDATE transactions SET transfer_pair_id = NULL
   WHERE transfer_pair_id BETWEEN 700 AND 820 AND id NOT BETWEEN 700 AND 820;
  DELETE FROM transaction_splits WHERE transaction_id BETWEEN 700 AND 820;
  DELETE FROM transactions
   WHERE id BETWEEN 700 AND 820
     AND account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';

  -- 2b. Move the unique Feb 12 – Mar 10 history (ids 821–860) onto the
  --     Plaid account so nothing is lost.
  UPDATE transactions
     SET account_id = 'e7cf01fe-b750-426d-b526-e1ac6af731af'
   WHERE id BETWEEN 821 AND 860
     AND account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';

  -- Keep VISA PLATINUM's displayed balance unchanged (displayed = opening +
  -- txn net; we just added the moved rows' net). Nightly Plaid sync
  -- re-reconciles to the bank figure regardless.
  UPDATE accounts
     SET balance = balance - (
       SELECT COALESCE(SUM(amount), 0) FROM transactions
        WHERE id BETWEEN 821 AND 860
          AND account_id = 'e7cf01fe-b750-426d-b526-e1ac6af731af'
     )
   WHERE id = 'e7cf01fe-b750-426d-b526-e1ac6af731af';

  -- 2c. Delete the now-empty manual account and its remaining references.
  DELETE FROM transaction_splits WHERE transaction_id IN
    (SELECT id FROM transactions WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71');
  DELETE FROM transactions WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  DELETE FROM import_batches WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  DELETE FROM account_members WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  DELETE FROM income_sources WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  DELETE FROM expected_income WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  UPDATE allocation_rules SET from_account_id = NULL WHERE from_account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  UPDATE allocation_rules SET to_account_id = NULL WHERE to_account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  UPDATE transfer_instances SET from_account_id = NULL WHERE from_account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  UPDATE transfer_instances SET to_account_id = NULL WHERE to_account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
  DELETE FROM accounts WHERE id = '3ba3ba9f-01dc-49e1-9285-03d907684e71';
commit;

-- ---------- 3) notification dedupe uniqueness -----------------------------
DELETE FROM notifications WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY dedupe_key ORDER BY id) AS rn
    FROM notifications WHERE dedupe_key IS NOT NULL
  ) d WHERE d.rn > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_dedupe
  ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ---------- 4) transfer_instances: period key + idempotency ---------------
ALTER TABLE transfer_instances ADD COLUMN IF NOT EXISTS period_key text;
-- one generated instance per (rule, income txn) and per triggered_by tag
CREATE UNIQUE INDEX IF NOT EXISTS uq_ti_rule_income
  ON transfer_instances (rule_id, trigger_income_txn_id)
  WHERE trigger_income_txn_id IS NOT NULL AND rule_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ti_triggered_by
  ON transfer_instances (triggered_by) WHERE triggered_by IS NOT NULL;

-- ---------- 5) income_sources: gross pay + aliases -------------------------
-- gross_per_period: paystub gross per deposit (preferred when set).
-- gross_ratio: gross = net × ratio (fallback; observed household default
-- ≈ 2.0202, i.e. net/gross ≈ 0.495 — from the $990-per-paycheck = 15% of
-- gross pattern). tithe_enabled: whether this source accrues 10%+5%.
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS gross_per_period numeric(14,2);
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS gross_ratio numeric(8,4);
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS tithe_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS income_source_aliases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  uuid NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
  match_key  text NOT NULL UNIQUE
);

-- ---------- 6) finance_settings: giving config ----------------------------
ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tithing_rate numeric(6,4) NOT NULL DEFAULT 0.10;
ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS charity_rate numeric(6,4) NOT NULL DEFAULT 0.05;
ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS default_gross_ratio numeric(8,4) NOT NULL DEFAULT 2.0202;

-- ---------- 7) account roles ----------------------------------------------
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role text;
UPDATE accounts SET role = 'main'     WHERE id = 'f5438961-bb78-4122-8c0d-d249120a9e13'; -- JARED CHECKING
UPDATE accounts SET role = 'bills'    WHERE id = '6940e116-bc19-44e3-b32d-0ed68f95214e'; -- BILLS
UPDATE accounts SET role = 'budget'   WHERE id = '9f5818f1-43a5-4526-b7f1-721fbc268276'; -- BUDGET
UPDATE accounts SET role = 'charity'  WHERE id = '7fc39a52-c1a5-4897-ac68-0d0f44be6324'; -- CHARITY MONEY MA
UPDATE accounts SET role = 'personal' WHERE id IN (
  '6ba8a535-52df-41f5-a6a1-3c181d466d14', -- Jae
  '3166f8e2-7e99-4cfa-9211-40e3067d1335', -- KATELYNN CHECKIN
  'e9e8cbba-deab-4cf1-9690-b0db6ff58767', -- Azaleah Jade
  '3819ac4c-3c1e-40d2-8a3d-8206177e0f94', -- Emerick Wade
  '4681c974-bb8c-46ba-9335-5de528fd88e2'  -- JARED SAVINGS
);

-- ---------- 8) recurring giving commitments --------------------------------
CREATE TABLE IF NOT EXISTS giving_commitments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  amount      numeric(14,2) NOT NULL,
  cadence     text NOT NULL DEFAULT 'monthly',   -- monthly | yearly | seasonal
  month_hint  int,                               -- for seasonal (e.g. 12 = December)
  category_id text REFERENCES categories(id),
  active      boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamp DEFAULT now()
);

-- ---------- 9) receipt item normalization ----------------------------------
ALTER TABLE receipt_lines ADD COLUMN IF NOT EXISTS canonical_name text;
CREATE INDEX IF NOT EXISTS idx_receipt_lines_canonical ON receipt_lines (canonical_name);

-- ---------- 10) plaid sync lock --------------------------------------------
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS syncing_at timestamptz;

-- ---------- 11) person attribution backfill ---------------------------------
-- A transaction on an account with exactly ONE assigned manager belongs to
-- that member (Jae's card spend is Jaelynn's). Sync now sets this going
-- forward; this backfills history so member spending stats include it.
-- Shared accounts (2 managers) stay unattributed (= Household).
UPDATE transactions t
   SET member_id = solo.member_id
  FROM (
    SELECT account_id, min(member_id) AS member_id
    FROM account_members
    GROUP BY account_id
    HAVING count(*) = 1
  ) solo
 WHERE t.account_id = solo.account_id
   AND t.member_id IS NULL;

-- ---------- verification ----------------------------------------------------
SELECT 'manual visa remaining txns' AS check, count(*)::text AS value FROM transactions WHERE account_id = '3ba3ba9f-01dc-49e1-9285-03d907684e71'
UNION ALL
SELECT 'visa platinum txns', count(*)::text FROM transactions WHERE account_id = 'e7cf01fe-b750-426d-b526-e1ac6af731af'
UNION ALL
SELECT 'manual visa account rows', count(*)::text FROM accounts WHERE id = '3ba3ba9f-01dc-49e1-9285-03d907684e71'
UNION ALL
SELECT 'dup dedupe_hash groups', count(*)::text FROM (
  SELECT 1 FROM transactions WHERE dedupe_hash IS NOT NULL
  GROUP BY account_id, dedupe_hash HAVING count(*) > 1
) g
UNION ALL
SELECT 'accounts with role', count(*)::text FROM accounts WHERE role IS NOT NULL;
