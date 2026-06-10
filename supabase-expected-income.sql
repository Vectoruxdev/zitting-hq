-- Zitting Finance — manually-entered / adjusted expected income (migration 0008).
-- Feeds the transfer-coverage forecast. Idempotent; safe to run repeatedly.
-- RUN THIS BEFORE DEPLOYING the code that reads it.
CREATE TABLE IF NOT EXISTS expected_income (
  id            text PRIMARY KEY,
  label         text NOT NULL,
  amount        numeric(14,2) NOT NULL,
  expected_date date NOT NULL,
  source_key    text,                          -- detected source being overridden; null = one-off
  account_id    text REFERENCES accounts(id),  -- deposit target (for source matching)
  status        text NOT NULL DEFAULT 'pending', -- pending | received | skipped
  created_by    text,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expected_income_date ON expected_income (expected_date);
