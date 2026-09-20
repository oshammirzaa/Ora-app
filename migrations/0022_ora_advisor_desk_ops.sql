-- Advisor desk operations: private reminders, client favorites, reports, weekly hours.
-- Additive only. Does not alter wallets, payments, readings, membership, or loyalty spend.

alter table ora_advisors add column if not exists hours_json text not null default '';

create table if not exists ora_advisor_reminders (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  due_at timestamptz not null,
  note text not null default '',
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ora_advisor_reminders_adv_idx
  on ora_advisor_reminders (advisor_id, done_at, due_at);

create table if not exists ora_advisor_client_favorites (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
);

create table if not exists ora_advisor_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  kind text not null,
  reason text not null,
  body text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists ora_advisor_reports_adv_idx
  on ora_advisor_reports (advisor_id, created_at desc);

create index if not exists ora_advisor_reports_status_idx
  on ora_advisor_reports (status, created_at desc);
