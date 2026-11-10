create table if not exists ora_reading_ends (
  reading_id text primary key,
  reason text not null default '',
  recorded_at timestamptz not null default now()
);
