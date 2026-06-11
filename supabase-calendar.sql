-- Calendar module: read-only Google Calendar ICS feeds + in-app family events.
-- Run in the Supabase SQL Editor. Idempotent + additive only.

create table if not exists calendar_feeds (
  id serial primary key,
  name text not null,
  color text,
  url text not null,                          -- Google Calendar "secret address in iCal format"
  enabled boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists family_events (
  id serial primary key,
  title text not null,
  date date not null,
  end_date date,                              -- inclusive; null = single day
  time text,                                  -- "18:30"; null = all-day
  color text,
  note text,
  created_by text references family_members(id),
  created_at timestamptz default now()
);
create index if not exists idx_family_events_date on family_events(date);
