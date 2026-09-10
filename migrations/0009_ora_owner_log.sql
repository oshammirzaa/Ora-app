create table if not exists ora_owner_log (
  id text primary key,
  actor_id text not null,
  act text not null,
  target_type text not null default '',
  target_id text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_owner_log_created_idx on ora_owner_log (created_at desc);
