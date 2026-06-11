-- Receipts: uploaded receipt images, matchable to transactions.
-- Run in the Supabase SQL Editor. Idempotent + additive only.

create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,            -- object key inside the 'receipts' bucket
  filename text,                         -- original filename (display only)
  mime text,
  size_bytes integer,
  status text not null default 'inbox',  -- inbox | matched
  transaction_id integer references transactions(id) on delete set null,
  uploaded_by text references family_members(id),
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_receipts_status on receipts(status);
create index if not exists idx_receipts_txn on receipts(transaction_id);

-- Private storage bucket for the images (no public access; the app serves
-- short-lived signed URLs via the service-role client). Idempotent.
insert into storage.buckets (id, name, public)
  values ('receipts', 'receipts', false)
  on conflict (id) do nothing;
