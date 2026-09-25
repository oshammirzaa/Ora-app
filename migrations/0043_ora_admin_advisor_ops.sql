-- Owner view-as sessions and auditable admin review edits.
-- Additive only. Does not change wallets, payouts, or customer review rules.

create table if not exists ora_view_as (
  id text primary key,
  admin_id text not null,
  advisor_id text not null,
  advisor_user_id text not null default '',
  advisor_name text not null default '',
  reason text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists ora_view_as_admin_idx on ora_view_as (admin_id, started_at desc);

alter table ora_reviews add column if not exists source text not null default 'customer';
alter table ora_reviews add column if not exists created_by text not null default '';
alter table ora_reviews add column if not exists client_label text not null default '';

create table if not exists ora_review_audit (
  id text primary key,
  review_id text not null,
  advisor_id text not null,
  admin_id text not null,
  action text not null,
  before_json text not null default '',
  after_json text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_review_audit_advisor_idx on ora_review_audit (advisor_id, created_at desc);
