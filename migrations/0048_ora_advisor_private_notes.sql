-- One private note per advisor + client. Used by the incoming-request
-- screen and the live-chat header. Clients and other advisors cannot read it.
-- Additive only. Does not change readings, billing, messages, or payouts.

create table if not exists ora_advisor_notes (
  advisor_id text not null,
  customer_id text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (advisor_id, customer_id)
);
