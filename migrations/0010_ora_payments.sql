alter table ora_wallets add column if not exists promo_coins integer not null default 0;

alter table ora_advisors add column if not exists pending_coins integer not null default 0;

alter table ora_settings add column if not exists min_payout_coins integer not null default 50;
alter table ora_settings add column if not exists payout_hold_hours integer not null default 0;

alter table ora_payouts add column if not exists approved_at timestamptz;
alter table ora_payouts add column if not exists paid_at timestamptz;
alter table ora_payouts add column if not exists currency text not null default 'USD';
alter table ora_payouts add column if not exists amount_cents integer not null default 0;

create table if not exists ora_coin_packs (
  id text primary key,
  name text not null,
  coins integer not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  active boolean not null default true,
  sort_order integer not null default 0
);
insert into ora_coin_packs (id, name, coins, amount_cents, currency, active, sort_order) values
  ('10', 'Starter', 10, 100, 'USD', true, 1),
  ('50', 'Session', 50, 500, 'USD', true, 2),
  ('100', 'Circle', 100, 1000, 'USD', true, 3),
  ('300', 'House', 300, 2500, 'USD', true, 4)
on conflict (id) do nothing;

create table if not exists ora_payments (
  id text primary key,
  user_id text not null,
  pack_id text not null,
  provider text not null,
  provider_ref text not null default '',
  amount_cents integer not null,
  currency text not null,
  coins integer not null,
  status text not null default 'created',
  idempotency_key text not null,
  return_to text not null default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ora_payments_idempotency_idx on ora_payments (idempotency_key);
create unique index if not exists ora_payments_provider_ref_idx on ora_payments (provider_ref) where provider_ref <> '';
create index if not exists ora_payments_user_idx on ora_payments (user_id, created_at desc);

create table if not exists ora_webhook_events (
  id text primary key,
  provider text not null,
  type text not null,
  payment_id text not null default '',
  processed_at timestamptz not null default now()
);

create table if not exists ora_earnings (
  id text primary key,
  advisor_id text not null,
  reading_id text not null,
  gross_coins integer not null,
  commission_coins integer not null,
  net_coins integer not null,
  status text not null default 'pending',
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists ora_earnings_reading_idx on ora_earnings (reading_id);
create index if not exists ora_earnings_advisor_idx on ora_earnings (advisor_id, status, available_at);

create unique index if not exists ora_ledger_kind_ref_idx on ora_ledger (kind, ref_id) where ref_id <> '';
