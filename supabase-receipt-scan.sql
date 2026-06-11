-- Receipt scanning v2: extracted merchant/total/date, line items, and
-- auto-match suggestions. Run AFTER supabase-receipts.sql.
-- Run in the Supabase SQL Editor. Idempotent + additive only.

alter table receipts add column if not exists merchant text;
alter table receipts add column if not exists total numeric(14,2);
alter table receipts add column if not exists receipt_date date;
-- none = not scanned | scanned | failed | manual (lines typed by hand)
alter table receipts add column if not exists scan_status text not null default 'none';
alter table receipts add column if not exists suggested_transaction_id integer references transactions(id) on delete set null;

create table if not exists receipt_lines (
  id serial primary key,
  receipt_id uuid not null references receipts(id) on delete cascade,
  name text not null,
  qty numeric(10,2),
  price numeric(14,2),
  sort_order integer not null default 0
);
create index if not exists idx_receipt_lines_receipt on receipt_lines(receipt_id);
