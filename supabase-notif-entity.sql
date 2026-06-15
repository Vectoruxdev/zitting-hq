-- Notification → entity linkage: lets a notification click open the specific
-- thing it's about (a transaction, a transfer, an account's review, …) instead
-- of just the list screen. Resolved to a live entity at read time.
-- Run in the Supabase SQL Editor. Idempotent + additive only.

alter table notifications add column if not exists entity_type text;
alter table notifications add column if not exists entity_ref  text;
