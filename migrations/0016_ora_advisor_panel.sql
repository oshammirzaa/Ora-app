-- Advisor panel Phase 1: presence history and text-reading activity.
-- Additive only. Existing wallets, readings, and payouts are untouched.

alter table ora_advisors add column if not exists last_online_at timestamptz;
alter table ora_advisors add column if not exists last_offline_at timestamptz;
alter table ora_advisors add column if not exists current_presence_id text not null default '';

create table if not exists ora_advisor_presence (
  id text primary key,
  advisor_id text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer not null default 0,
  source text not null default 'toggle'
);

create index if not exists ora_advisor_presence_advisor_idx
  on ora_advisor_presence (advisor_id, started_at desc);

create unique index if not exists ora_advisor_presence_open_idx
  on ora_advisor_presence (advisor_id)
  where ended_at is null;

create table if not exists ora_reading_activity (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  reading_id text not null unique,
  started_at timestamptz not null,
  ended_at timestamptz,
  seconds integer not null default 0,
  minutes numeric(12, 2) not null default 0,
  coins_spent integer not null default 0,
  advisor_earnings integer not null default 0,
  platform_revenue integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ora_reading_activity_advisor_idx
  on ora_reading_activity (advisor_id, started_at desc);

create index if not exists ora_reading_activity_customer_idx
  on ora_reading_activity (customer_id, started_at desc);
