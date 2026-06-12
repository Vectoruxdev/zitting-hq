-- =============================================================
-- Zitting Finance — remove RE-LINK duplicate transactions.
--
-- What happened: re-linking a bank in Plaid issues a brand-new item with
-- brand-new transaction_ids for the same real transactions. The id-based
-- dedupe hash (`ext:<account>:<plaid_txn_id>`) therefore saw the second
-- backfill as all-new rows and the account's whole history imported twice
-- (seen live on JARED CHECKING ••6092: every txn Mar 11 – Jun 4 2026 exists
-- twice, ids ~1199-1276 and ~1279-1356 — paychecks, transfers, spending).
--
-- This script removes content-identical twins (same account + date + amount
-- + merchant) that arrived via a DIFFERENT import batch than the copy we
-- keep. Same-batch identical rows (two genuine same-day purchases imported
-- together) are never touched. Of each twin group we keep the "best" row:
-- reviewed first, then categorized, then the earliest id.
--
-- It also repairs everything that pointed at a removed row (transfer
-- completions, receipt links, transfer-pair links, splits) and adjusts each
-- account's opening balance so the displayed balance does not jump.
--
-- Idempotent — safe to re-run. Run in Supabase → SQL Editor.
-- (Code-side prevention shipped alongside this: commitImport now also
--  dedupes by content key, so a future re-link can't double-import again.)
-- =============================================================

begin;

create temp table _relink_dups on commit drop as
with ranked as (
  select
    id, account_id, date, amount, merchant, import_batch_id,
    row_number() over (
      partition by account_id, date, amount, merchant
      order by
        reviewed desc,
        (category_id is not null and category_id <> 'uncategorized') desc,
        id asc
    ) as rn
  from transactions
  where date is not null
),
keepers as (
  select account_id, date, amount, merchant, id as keep_id, import_batch_id as keep_batch
  from ranked where rn = 1
)
select r.id, k.keep_id, r.account_id, r.amount
from ranked r
join keepers k
  on  k.account_id = r.account_id
  and k.date       = r.date
  and k.amount     = r.amount
  and k.merchant   = r.merchant
where r.rn > 1
  and r.import_batch_id is distinct from k.keep_batch;

-- Re-point references from removed rows to the kept twin.
update transfer_instances ti
   set completed_txn_id = d.keep_id
  from _relink_dups d
 where ti.completed_txn_id = d.id;

update receipts r
   set transaction_id = d.keep_id
  from _relink_dups d
 where r.transaction_id = d.id;

update receipts r
   set suggested_transaction_id = d.keep_id
  from _relink_dups d
 where r.suggested_transaction_id = d.id;

-- Unlink transfer pairs that pointed at a removed leg (the surviving legs are
-- re-paired automatically by autoLinkTransfers on the next import/sync).
update transactions t
   set transfer_pair_id = null
  from _relink_dups d
 where t.transfer_pair_id = d.id
   and t.id not in (select id from _relink_dups);

delete from transaction_splits
 where transaction_id in (select id from _relink_dups);

-- Keep displayed balances unchanged: displayed = opening + txn net, and we are
-- about to remove `sum(amount)` of net per account, so add it to opening.
-- (The nightly Plaid sync re-reconciles opening to the bank figure anyway —
-- this just avoids a wrong balance until then.)
update accounts a
   set balance = (coalesce(a.balance, 0) + d.removed_net)
  from (
    select account_id, sum(amount) as removed_net
    from _relink_dups group by account_id
  ) d
 where a.id = d.account_id;

delete from transactions
 where id in (select id from _relink_dups);

commit;

-- Quick verification: remaining content-twin groups that span import batches
-- (expect zero rows, or only known-legitimate repeats).
select account_id, date, amount, merchant, count(*) as copies
from transactions
where date is not null
group by account_id, date, amount, merchant
having count(*) > 1 and count(distinct import_batch_id) > 1
order by date desc
limit 50;
