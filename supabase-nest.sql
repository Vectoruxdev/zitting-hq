-- Nest module (migration 0009): Google Nest cameras → Govee lights.
-- Idempotent — safe to run more than once. Paste into Supabase → SQL Editor,
-- or run `pnpm db:run supabase-nest.sql`.

-- Single-row Google OAuth token store (id always 'household'). The refresh
-- token is sensitive: server-side only, never sent to the client.
CREATE TABLE IF NOT EXISTS nest_tokens (
  id text PRIMARY KEY DEFAULT 'household',
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scope text,
  connected_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nest_devices (
  id text PRIMARY KEY,
  sdm_name text NOT NULL UNIQUE,
  type text,
  display_name text,
  room text,
  traits jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_event_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS govee_devices (
  device text PRIMARY KEY,
  model text NOT NULL,
  name text,
  controllable boolean NOT NULL DEFAULT true,
  supports_color boolean NOT NULL DEFAULT true,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);

-- camera × event type → light action (action shape documented in schema.ts).
CREATE TABLE IF NOT EXISTS nest_rules (
  id serial PRIMARY KEY,
  nest_device_id text NOT NULL REFERENCES nest_devices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  govee_device text NOT NULL REFERENCES govee_devices(device) ON DELETE CASCADE,
  action jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  active_start text,
  active_end text,
  cooldown_seconds integer NOT NULL DEFAULT 120,
  last_fired_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nest_rules_device ON nest_rules (nest_device_id);

-- Event log. UNIQUE event_id dedupes Pub/Sub at-least-once redelivery.
CREATE TABLE IF NOT EXISTS nest_events (
  id serial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  nest_device_id text,
  event_type text NOT NULL,
  event_at timestamptz,
  media jsonb,
  rule_id integer,
  action_status text NOT NULL DEFAULT 'none',
  action_error text,
  raw jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nest_events_device ON nest_events (nest_device_id);
CREATE INDEX IF NOT EXISTS idx_nest_events_created ON nest_events (created_at);
