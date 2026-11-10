-- Encrypted PDF copies of private readings, plus an admin access log.
-- Additive only. Does not change wallets, billing, commissions, or message rows.
-- The message table stays the source of truth. PDFs are archived copies.

create table if not exists ora_reading_archives (
  reading_id text primary key,
  ciphertext text not null,
  iv text not null,
  byte_length integer not null default 0,
  message_count integer not null default 0,
  generated_at timestamptz not null default now(),
  generated_by text not null default ''
);

create table if not exists ora_reading_access (
  id text primary key,
  admin_id text not null,
  reading_id text not null,
  customer_id text not null default '',
  advisor_id text not null default '',
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_reading_access_reading_idx
  on ora_reading_access (reading_id, created_at desc);

create index if not exists ora_reading_access_admin_idx
  on ora_reading_access (admin_id, created_at desc);
