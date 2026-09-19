-- Advisor profile extras and blocked customers.
-- Additive only. Does not alter wallets, readings, payouts, or historical rows.

alter table ora_advisors add column if not exists gender text not null default '';
alter table ora_advisors add column if not exists headline text not null default '';
alter table ora_advisors add column if not exists reading_notice text not null default '';
alter table ora_advisors add column if not exists quick_greeting text not null default '';
alter table ora_advisors add column if not exists auto_response text not null default '';
alter table ora_advisors add column if not exists auto_live_greeting text not null default '';
alter table ora_advisors add column if not exists gallery_json text not null default '[]';

create table if not exists ora_advisor_blocks (
  advisor_id text not null,
  customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
);

create index if not exists ora_advisor_blocks_adv_idx
  on ora_advisor_blocks (advisor_id, created_at desc);

create table if not exists ora_advisor_quick_replies (
  id text primary key,
  advisor_id text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ora_advisor_quick_replies_adv_idx
  on ora_advisor_quick_replies (advisor_id, sort_order, created_at);
