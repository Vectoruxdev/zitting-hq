-- Zitting Finance — member-managed accounts + allowance (migration 0005).
-- Idempotent: safe to run multiple times in the Supabase SQL Editor.
-- RUN THIS BEFORE DEPLOYING the code that reads these.

-- Per-member monthly spending money (owner-set). NULL = no allowance.
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS allowance numeric(14,2);

-- Which members are "in charge of" an account (categorize its transactions).
-- Up to 2 per account (enforced in the UI). Cascade-cleaned with the account/member.
CREATE TABLE IF NOT EXISTS account_members (
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_acctmem_member ON account_members (member_id);
