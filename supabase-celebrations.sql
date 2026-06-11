-- Per-member celebration style for the "all transactions reviewed" moment.
-- spicy = full message pack | clean = funny/sweet only | off = confetti only
-- Run in the Supabase SQL Editor. Idempotent + additive only.

alter table family_members add column if not exists celebration_style text not null default 'spicy';
