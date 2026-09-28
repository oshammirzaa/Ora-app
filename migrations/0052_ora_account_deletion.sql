-- Customer account deletion audit. Stores an opaque user id only.
-- No email, name, message, or photo is written here.

create table if not exists ora_account_deletions (
  id text primary key,
  user_id text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists ora_account_deletion_attempts (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_account_deletion_attempts_user_idx
  on ora_account_deletion_attempts (user_id, created_at desc);
