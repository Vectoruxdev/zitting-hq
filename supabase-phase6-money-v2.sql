-- Zitting HQ — Phase 6 of the 2026-09 revamp: Money v2 permissions.
-- account_members grows an `access` level so the shared groceries/bills
-- accounts can be visible to both wives as viewers while each still manages
-- her own; member_module_access lets the owner hide whole modules per person.
-- Idempotent; run before deploying Phase 6.

ALTER TABLE account_members ADD COLUMN IF NOT EXISTS access text NOT NULL DEFAULT 'manage';  -- manage | view

CREATE TABLE IF NOT EXISTS member_module_access (
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  module     text NOT NULL,                 -- slug from src/lib/modules.ts
  allowed    boolean NOT NULL DEFAULT true,
  PRIMARY KEY (member_id, module)
);

ALTER TABLE member_module_access ENABLE ROW LEVEL SECURITY;
