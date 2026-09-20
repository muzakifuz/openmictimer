-- Openmic Timer schema
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor).

create extension if not exists "uuid-ossp";

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  max_time_seconds integer not null default 300,
  min_time_seconds integer not null default 300,
  overtime_note_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists lineup_entries (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  position integer not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done')),
  started_at timestamptz,
  elapsed_seconds integer,
  badge text check (badge in ('under', 'on_time', 'overtime')),
  created_at timestamptz not null default now()
);

create index if not exists lineup_entries_event_id_idx on lineup_entries (event_id, position);

-- Row Level Security
alter table events enable row level security;
alter table lineup_entries enable row level security;

-- MVP note: there is no login screen in this app (matches the design).
-- Anyone who has an event's link can read and edit it, the same way a
-- shared Google Sheet link works. Don't publish a manage link publicly --
-- only share it with your co-hosts. If you later want real access control,
-- add Supabase Auth and tighten these policies to check auth.uid().
drop policy if exists "public read events" on events;
create policy "public read events" on events for select using (true);
drop policy if exists "public write events" on events;
create policy "public write events" on events for all using (true) with check (true);

drop policy if exists "public read lineup" on lineup_entries;
create policy "public read lineup" on lineup_entries for select using (true);
drop policy if exists "public write lineup" on lineup_entries;
create policy "public write lineup" on lineup_entries for all using (true) with check (true);

-- Realtime: lets the fullscreen timer and the manager list stay in sync
-- across devices (this is what powers "Transfer the Timer").
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table lineup_entries;
