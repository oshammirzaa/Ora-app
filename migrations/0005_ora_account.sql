alter table ora_profiles add column if not exists email text not null default '';

create table if not exists ora_favorites (
  user_id text not null,
  advisor_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, advisor_id)
);

create table if not exists ora_ledger (
  id text primary key,
  user_id text not null,
  kind text not null,
  amount_coins integer not null default 0,
  seconds integer not null default 0,
  note text not null default '',
  ref_id text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_ledger_user_idx on ora_ledger (user_id, created_at desc);

create table if not exists ora_password_resets (
  id text primary key,
  user_id text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
