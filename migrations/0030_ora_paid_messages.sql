create table if not exists ora_customer_message_allowance (
  customer_id text not null,
  advisor_id text not null,
  free_used integer not null default 0,
  paid_sent integer not null default 0,
  paid_notice_seen boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (customer_id, advisor_id)
);

create table if not exists ora_paid_messages (
  id text primary key,
  message_id text not null unique,
  request_id text not null unique,
  customer_id text not null,
  advisor_id text not null,
  thread_id text not null,
  coins integer not null,
  amount_cents integer not null,
  advisor_share_coins integer not null,
  ora_share_coins integer not null,
  advisor_share_cents integer not null,
  ora_share_cents integer not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_paid_messages_advisor_idx
  on ora_paid_messages (advisor_id, created_at desc);
create index if not exists ora_paid_messages_customer_idx
  on ora_paid_messages (customer_id, created_at desc);

alter table ora_advisor_inbox_messages add column if not exists request_id text;
create unique index if not exists ora_inbox_msg_request_idx
  on ora_advisor_inbox_messages (request_id)
  where request_id is not null;
