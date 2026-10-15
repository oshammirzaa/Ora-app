-- Membership-gated spiritual tools. Additive only.
-- Does not change coin prices, commission, welcome minutes, subscriptions, or existing rows.
-- Paid reading extensions stay at zero credit until an explicit authorized purchase.

alter table ora_readings add column if not exists time_credit_seconds integer not null default 0;

create table if not exists ora_premium_prefs (
  user_id text primary key,
  timezone text not null default 'UTC',
  interests text not null default '',
  notify_tarot boolean not null default false,
  notify_moon boolean not null default false,
  notify_affirm boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists ora_compatibility_reports (
  id text primary key,
  user_id text not null,
  self_name text not null,
  self_birth text not null,
  partner_name text not null,
  partner_birth text not null,
  relationship_status text not null default '',
  overall integer not null,
  emotional integer not null,
  communication integer not null,
  romantic integer not null,
  long_term integer not null,
  report_json text not null,
  created_at timestamptz not null default now()
);
create index if not exists ora_compatibility_user_idx
  on ora_compatibility_reports (user_id, created_at desc);

create table if not exists ora_daily_tarot (
  user_id text not null,
  local_date text not null,
  card_id text not null,
  revealed_at timestamptz,
  primary key (user_id, local_date)
);

create table if not exists ora_future_messages (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  reading_id text not null,
  body text not null,
  unlock_at timestamptz not null,
  status text not null default 'locked',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unlocked_at timestamptz
);
create index if not exists ora_future_messages_customer_idx
  on ora_future_messages (customer_id, unlock_at);
create index if not exists ora_future_messages_advisor_idx
  on ora_future_messages (advisor_id, created_at desc);

create table if not exists ora_relationship_events (
  id text primary key,
  user_id text not null,
  event_date text not null,
  title text not null,
  kind text not null default 'milestone',
  notes text not null default '',
  reading_id text not null default '',
  expected boolean not null default false,
  happened text not null default '',
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ora_relationship_events_user_idx
  on ora_relationship_events (user_id, event_date desc);

create table if not exists ora_waiting_queue (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  status text not null default 'waiting',
  offer_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ora_waiting_queue_advisor_idx
  on ora_waiting_queue (advisor_id, status, created_at);
create unique index if not exists ora_waiting_queue_active_idx
  on ora_waiting_queue (advisor_id, customer_id)
  where status in ('waiting', 'offered');

create table if not exists ora_card_picks (
  user_id text not null,
  local_date text not null,
  card_index integer not null,
  card_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table if not exists ora_mood_checkins (
  id text primary key,
  user_id text not null,
  local_date text not null,
  mood text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index if not exists ora_mood_checkins_user_idx
  on ora_mood_checkins (user_id, local_date desc);

create table if not exists ora_reading_highlights (
  id text primary key,
  reading_id text not null unique,
  advisor_id text not null,
  customer_id text not null,
  insights text not null,
  topics text not null default '',
  next_steps text not null default '',
  reflection text not null default '',
  status text not null default 'draft',
  reported boolean not null default false,
  created_at timestamptz not null default now(),
  shared_at timestamptz
);

create table if not exists ora_moon_views (
  user_id text not null,
  local_date text not null,
  primary key (user_id, local_date)
);

create table if not exists ora_affirmations (
  id text primary key,
  user_id text not null,
  local_date text not null,
  category text not null,
  body text not null,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, local_date, category)
);
create index if not exists ora_affirmations_user_idx
  on ora_affirmations (user_id, created_at desc);

create table if not exists ora_reading_extensions (
  id text primary key,
  reading_id text not null,
  client_id text not null,
  token text not null,
  minutes integer not null,
  coins integer not null,
  seconds integer not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (reading_id, token)
);
create index if not exists ora_reading_extensions_reading_idx
  on ora_reading_extensions (reading_id, created_at desc);

create table if not exists ora_customer_badges (
  user_id text not null,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
