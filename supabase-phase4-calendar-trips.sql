-- Zitting HQ — Phase 4 of the 2026-09 revamp: Calendar v2, Appointments, Trips.
-- Idempotent; run before deploying Phase 4 (reads degrade to empty until then).

-- Unified events: kind = event | appointment. Appointments carry who it's for,
-- who's driving, where, and what has to happen before.
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'event';
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS end_time text;
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS for_member_id text REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS driver_member_id text REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS prep_notes text;
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'family';
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS trip_id text;
ALTER TABLE family_events ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_family_events_kind ON family_events (kind, date);
CREATE INDEX IF NOT EXISTS idx_family_events_for ON family_events (for_member_id);

-- Reminders: pushed by /api/reminders/cron (every 15 min) to the people involved.
CREATE TABLE IF NOT EXISTS event_reminders (
  id              serial PRIMARY KEY,
  event_id        integer NOT NULL REFERENCES family_events(id) ON DELETE CASCADE,
  minutes_before  integer NOT NULL,
  sent_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_event_reminders_pending ON event_reminders (sent_at) WHERE sent_at IS NULL;

-- Trips & plans.
CREATE TABLE IF NOT EXISTS trips (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  destination     text,
  starts_on       date,
  ends_on         date,
  cover_photo_id  text REFERENCES photos(id) ON DELETE SET NULL,
  notes           text,
  created_by      text REFERENCES family_members(id) ON DELETE SET NULL,
  visibility      text NOT NULL DEFAULT 'family',
  goal_id         text,                                   -- Phase 5 link to a family goal
  created_at      timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trip_participants (
  trip_id    text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, member_id)
);
CREATE TABLE IF NOT EXISTS trip_items (
  id        serial PRIMARY KEY,
  trip_id   text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day       date,
  time      text,
  title     text NOT NULL,
  location  text,
  notes     text,
  url       text,
  sort      integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_trip_items_trip ON trip_items (trip_id, day, sort);
CREATE TABLE IF NOT EXISTS trip_documents (
  id            text PRIMARY KEY,
  trip_id       text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,                           -- private 'documents' bucket
  name          text NOT NULL,
  mime          text,
  size_bytes    integer,
  uploaded_by   text REFERENCES family_members(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS trip_packing (
  id                  serial PRIMARY KEY,
  trip_id             text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  label               text NOT NULL,
  assignee_member_id  text REFERENCES family_members(id) ON DELETE SET NULL,
  checked             boolean NOT NULL DEFAULT false,
  sort                integer NOT NULL DEFAULT 0
);

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_packing ENABLE ROW LEVEL SECURITY;
