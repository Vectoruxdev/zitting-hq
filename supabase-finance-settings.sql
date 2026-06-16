-- Zitting Finance — single-row household finance config (migration 0014).
-- Holds the cash-runway low-balance warning: the safety cushion an account is
-- warned about dropping below before the next income lands, plus a master
-- on/off. Idempotent; safe to run repeatedly. RUN BEFORE DEPLOYING the code
-- that reads it (queries.ts getFinanceData + mutations.ts notifyCashRunway).
CREATE TABLE IF NOT EXISTS finance_settings (
  id                  text PRIMARY KEY DEFAULT 'household',
  cash_runway_buffer  numeric(14,2) NOT NULL DEFAULT 300,
  cash_runway_enabled boolean NOT NULL DEFAULT true,
  updated_at          timestamp DEFAULT now()
);

-- Seed the singleton row so reads never depend on insert-on-first-write.
INSERT INTO finance_settings (id) VALUES ('household')
ON CONFLICT (id) DO NOTHING;
