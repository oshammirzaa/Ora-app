alter table ora_advisors add column if not exists legal_name text not null default '';
alter table ora_advisors add column if not exists languages text not null default 'English';
alter table ora_advisors add column if not exists years integer not null default 0;
alter table ora_advisors add column if not exists online boolean not null default false;
alter table ora_advisors add column if not exists busy boolean not null default false;
alter table ora_advisors add column if not exists payout_coins integer not null default 0;

alter table ora_applications add column if not exists legal_name text not null default '';
alter table ora_applications add column if not exists languages text not null default 'English';
alter table ora_applications add column if not exists years integer not null default 0;

update ora_advisors set online = true, years = 12, languages = 'English, French' where id = 'adv_mira';
update ora_advisors set online = true, years = 18, languages = 'English' where id = 'adv_rowan';
update ora_advisors set online = true, years = 9, languages = 'English' where id = 'adv_imani';
update ora_advisors set online = true, years = 10, languages = 'English' where id = 'adv_soren';
update ora_advisors set online = true where user_id like 'seed:%' and online = false;

create table if not exists ora_chat_requests (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  reading_id text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists ora_chat_requests_adv_idx on ora_chat_requests (advisor_id, status, created_at desc);
create index if not exists ora_chat_requests_client_idx on ora_chat_requests (client_id, created_at desc);

create table if not exists ora_reviews (
  id text primary key,
  reading_id text not null,
  client_id text not null,
  advisor_id text not null,
  rating integer not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists ora_reviews_reading_idx on ora_reviews (reading_id);

create table if not exists ora_payouts (
  id text primary key,
  user_id text not null,
  advisor_id text not null,
  coins integer not null,
  usd numeric(10,2) not null,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);
create index if not exists ora_payouts_user_idx on ora_payouts (user_id, created_at desc);
