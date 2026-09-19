-- Advisor desk expansion: notes, inbox, gifts, pay requests, live-chat flag.
-- Additive only. Does not alter wallets, readings, payouts, or historical rows.

alter table ora_advisors add column if not exists accepts_chat boolean not null default true;

create table if not exists ora_advisor_notes (
  advisor_id text not null,
  customer_id text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
);

create table if not exists ora_advisor_inbox (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  last_body text not null default '',
  last_role text not null default 'advisor',
  last_at timestamptz not null default now(),
  unread_advisor integer not null default 0,
  unread_customer integer not null default 0,
  unique (advisor_id, customer_id)
);

create index if not exists ora_advisor_inbox_adv_idx
  on ora_advisor_inbox (advisor_id, last_at desc);

create table if not exists ora_advisor_inbox_messages (
  id text primary key,
  thread_id text not null,
  advisor_id text not null,
  customer_id text not null,
  role text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_advisor_inbox_msg_idx
  on ora_advisor_inbox_messages (thread_id, created_at);

create table if not exists ora_advisor_gifts (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  seconds integer not null,
  created_at timestamptz not null default now()
);

create table if not exists ora_advisor_pay_requests (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  coins integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
