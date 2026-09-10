alter table ora_readings add column if not exists rate_coins integer not null default 20;
alter table ora_readings add column if not exists advisor_earned integer not null default 0;
alter table ora_readings add column if not exists platform_fee integer not null default 0;
alter table ora_readings add column if not exists last_billed_at timestamptz;

update ora_readings set last_billed_at = started_at where last_billed_at is null;
update ora_readings
  set advisor_earned = (coins_spent * 7) / 10,
      platform_fee = coins_spent - (coins_spent * 7) / 10
  where coins_spent > 0 and advisor_earned = 0;

create table if not exists ora_platform_ledger (
  id text primary key,
  reading_id text not null,
  coins integer not null,
  created_at timestamptz not null default now()
);
create unique index if not exists ora_platform_ledger_reading_idx on ora_platform_ledger (reading_id);
