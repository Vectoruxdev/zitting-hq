-- Zitting HQ — Cleaning (2026-09-10): lists, tasks with rhythms, completions per
-- period, and hand-offs. Replaces the never-used Chores tables (chores,
-- chore_completions), which are left in place for now. Idempotent; additive.
CREATE TABLE IF NOT EXISTS cleaning_lists (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  icon             text,
  tint             text,
  visibility       text NOT NULL DEFAULT 'family',            -- family | personal
  owner_member_id  text REFERENCES family_members(id) ON DELETE CASCADE,
  remind_time      text,                                       -- HH:MM family time; NULL = default morning digest
  sort             integer NOT NULL DEFAULT 0,
  created_by       text REFERENCES family_members(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  archived_at      timestamptz
);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id            text PRIMARY KEY,
  list_id       text NOT NULL REFERENCES cleaning_lists(id) ON DELETE CASCADE,
  title         text NOT NULL,
  icon          text,
  notes         text,
  rhythm        jsonb NOT NULL,                                -- {type: daily | weekly | every_weeks | monthly | once, …}
  assign        jsonb NOT NULL,                                -- {mode: anyone | person | rotation, …}
  time_of_day   text NOT NULL DEFAULT 'any',                   -- morning | afternoon | evening | any
  points        integer NOT NULL DEFAULT 0,
  needs_check   boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  sort          integer NOT NULL DEFAULT 0,
  created_by    text REFERENCES family_members(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_list ON cleaning_tasks (list_id);

CREATE TABLE IF NOT EXISTS cleaning_completions (
  id          serial PRIMARY KEY,
  task_id     text NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,
  period_key  text NOT NULL,                                   -- YYYY-MM-DD (day / week's Sunday / once) or YYYY-MM (month)
  member_id   text REFERENCES family_members(id) ON DELETE SET NULL,
  done_at     timestamptz DEFAULT now(),
  checked_by  text REFERENCES family_members(id) ON DELETE SET NULL,
  checked_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS cleaning_completions_task_period_key ON cleaning_completions (task_id, period_key);
CREATE INDEX IF NOT EXISTS idx_cleaning_completions_done_at ON cleaning_completions (done_at);

CREATE TABLE IF NOT EXISTS cleaning_handoffs (
  task_id       text NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,
  period_key    text NOT NULL,
  member_id     text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  by_member_id  text REFERENCES family_members(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, period_key)
);

ALTER TABLE cleaning_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_handoffs ENABLE ROW LEVEL SECURITY;
