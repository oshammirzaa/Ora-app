alter table ora_payments add column if not exists wallet text not null default '';

alter table ora_advisors add column if not exists public_hold text not null default '';

create table if not exists ora_identity_checks (
  id text primary key,
  application_id text not null,
  user_id text not null,
  legal_name text not null,
  country text not null,
  id_type text not null,
  status text not null default 'pending',
  rejection_reason text not null default '',
  consent_at timestamptz not null,
  reviewed_by text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ora_identity_checks_app_idx on ora_identity_checks (application_id, created_at desc);
create index if not exists ora_identity_checks_user_idx on ora_identity_checks (user_id, created_at desc);

create table if not exists ora_identity_files (
  id text primary key,
  check_id text not null,
  side text not null,
  content_type text not null,
  byte_size integer not null,
  body_b64 text not null default '',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ora_identity_files_check_idx on ora_identity_files (check_id, side);
