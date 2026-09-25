alter table ora_payouts add column if not exists method text not null default '';
alter table ora_payouts add column if not exists reference_id text not null default '';
alter table ora_payouts add column if not exists idempotency_key text not null default '';
create unique index if not exists ora_payouts_idempotency_idx
  on ora_payouts (idempotency_key)
  where idempotency_key <> '';
