create table if not exists ora_customer_tips (
  id text primary key,
  request_id text not null,
  customer_id text not null,
  advisor_id text not null,
  gift text not null,
  coins integer not null,
  advisor_share_coins integer not null,
  ora_share_coins integer not null,
  charged boolean not null default false,
  credited boolean not null default false,
  surface text not null,
  thread_id text,
  reading_id text,
  message_id text,
  created_at timestamptz not null default now(),
  constraint ora_customer_tips_split check (advisor_share_coins + ora_share_coins = coins)
);

create unique index if not exists ora_customer_tips_request_idx on ora_customer_tips (request_id);
create index if not exists ora_customer_tips_advisor_idx on ora_customer_tips (advisor_id, created_at desc);

alter table ora_messages add column if not exists tip_gift text;
alter table ora_advisor_inbox_messages add column if not exists tip_gift text;
