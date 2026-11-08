alter table ora_identity_files add column if not exists iv text not null default '';

create table if not exists ora_identity_chunks (
  id text primary key,
  check_id text not null,
  side text not null,
  idx integer not null,
  total integer not null,
  iv text not null,
  body_b64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_identity_chunks_idx on ora_identity_chunks (check_id, side, idx);
