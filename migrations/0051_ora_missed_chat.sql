create table if not exists ora_missed_chat_penalties (
  id text primary key,
  advisor_id text not null,
  request_id text not null unique,
  penalty_coins integer not null,
  charged_coins integer not null,
  unpaid_coins integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_missed_chat_penalties_advisor_idx
  on ora_missed_chat_penalties (advisor_id, created_at desc);
