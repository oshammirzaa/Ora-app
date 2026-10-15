-- Additive advanced-feature tables. Does not change wallets, prices, commission, or existing rows.
-- Safe to apply more than once. Existing apps ignore these tables until a feature flag is on.

alter table ora_advisor_quick_replies add column if not exists category text not null default 'general';
alter table ora_favorites add column if not exists last_notified_at timestamptz;
alter table ora_tickets add column if not exists assignee_id text not null default '';
alter table ora_ticket_messages add column if not exists image_url text not null default '';

create table if not exists ora_advanced_settings (
  key text primary key,
  value_json text not null,
  updated_at timestamptz not null default now()
);

create table if not exists ora_booking_availability (
  advisor_id text primary key,
  timezone text not null default 'UTC',
  windows_json text not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists ora_scheduled_readings (
  id text primary key,
  customer_id text not null,
  advisor_id text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_min integer not null,
  note text not null default '',
  status text not null default 'pending',
  proposed_start timestamptz,
  proposed_end timestamptz,
  customer_tz text not null default '',
  reminded_customer text not null default '',
  reminded_advisor text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ora_scheduled_readings_advisor_idx
  on ora_scheduled_readings (advisor_id, start_at);
create index if not exists ora_scheduled_readings_customer_idx
  on ora_scheduled_readings (customer_id, start_at desc);

create table if not exists ora_reward_locks (
  user_id text primary key
);

create table if not exists ora_daily_reward_claims (
  id text primary key,
  user_id text not null,
  claimed_at timestamptz not null default now(),
  streak_day integer not null,
  coins integer not null,
  ip_hash text not null default '',
  device_hash text not null default ''
);
create index if not exists ora_daily_reward_claims_user_idx
  on ora_daily_reward_claims (user_id, claimed_at desc);
create index if not exists ora_daily_reward_claims_ip_idx
  on ora_daily_reward_claims (ip_hash, claimed_at desc);

create table if not exists ora_journals (
  id text primary key,
  user_id text not null,
  reading_id text not null default '',
  entry_date date not null,
  sealed text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ora_journals_user_idx on ora_journals (user_id, entry_date desc);

create table if not exists ora_referral_codes (
  user_id text primary key,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists ora_referrals (
  id text primary key,
  referrer_id text not null,
  referred_user_id text not null unique,
  code text not null,
  status text not null default 'pending',
  referrer_coins integer not null default 0,
  referred_coins integer not null default 0,
  reading_id text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists ora_referrals_referrer_idx on ora_referrals (referrer_id, created_at desc);

create table if not exists ora_reading_gifts (
  id text primary key,
  code text not null unique,
  buyer_id text not null,
  coins integer not null,
  message text not null default '',
  status text not null default 'unpaid',
  payment_ref text not null default '',
  redeemed_by text not null default '',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);
create index if not exists ora_reading_gifts_buyer_idx on ora_reading_gifts (buyer_id, created_at desc);

create table if not exists ora_security_events (
  id text primary key,
  user_id text not null,
  kind text not null,
  detail text not null default '',
  device text not null default '',
  ip_hash text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ora_security_events_user_idx
  on ora_security_events (user_id, created_at desc);

create table if not exists ora_totp (
  user_id text primary key,
  secret_sealed text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ora_chat_recovery_events (
  id text primary key,
  reading_id text not null,
  user_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists ora_chat_recovery_events_reading_idx
  on ora_chat_recovery_events (reading_id, created_at desc);
