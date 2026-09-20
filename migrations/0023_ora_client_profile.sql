-- Optional customer date of birth for advisor client profiles, plus a
-- timestamped private note log per advisor + client.
-- Additive only. Does not alter wallets, payments, refunds, membership,
-- loyalty spend, or live chat. Advisors never receive platform lifetime $.
-- The existing ora_advisor_notes row stays as the latest-snippet preview.

alter table ora_profiles add column if not exists date_of_birth text not null default '';

create table if not exists ora_advisor_note_entries (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ora_advisor_note_entries_adv_idx
  on ora_advisor_note_entries (advisor_id, customer_id, created_at desc);
