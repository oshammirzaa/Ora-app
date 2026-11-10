alter table ora_adjustments add column if not exists actor_id text not null default '';
alter table ora_adjustments add column if not exists previous_coins integer;
alter table ora_adjustments add column if not exists next_coins integer;
alter table ora_adjustments add column if not exists direction text not null default '';
alter table ora_adjustments add column if not exists idempotency_key text not null default '';
create unique index if not exists ora_adjustments_idem_idx
  on ora_adjustments (idempotency_key)
  where idempotency_key <> '';

alter table ora_applications add column if not exists decision_note text not null default '';

alter table ora_payouts add column if not exists method text not null default '';
alter table ora_payouts add column if not exists reference_id text not null default '';
alter table ora_payouts add column if not exists idempotency_key text not null default '';
create unique index if not exists ora_payouts_idempotency_idx
  on ora_payouts (idempotency_key)
  where idempotency_key <> '';

create table if not exists ora_payout_ledger (
  id text primary key,
  payout_id text not null default '',
  advisor_id text not null,
  actor_id text not null,
  verb text not null,
  coins integer not null,
  previous_available integer not null,
  next_available integer not null,
  reference_id text not null default '',
  note text not null default '',
  idempotency_key text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_payout_ledger_advisor_idx on ora_payout_ledger (advisor_id, created_at desc);
create unique index if not exists ora_payout_ledger_idem_idx
  on ora_payout_ledger (idempotency_key)
  where idempotency_key <> '';

create table if not exists ora_advisor_payout_methods (
  advisor_id text primary key,
  method text not null default '',
  holder text not null default '',
  account_label text not null default '',
  notes text not null default '',
  verified_by text not null default '',
  updated_at timestamptz not null default now()
);
