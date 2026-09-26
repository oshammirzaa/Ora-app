-- Advisor sign-in IP monitoring. Report only: never suspend, ban, or change rank.

create table if not exists ora_advisor_login_ips (
  id text primary key,
  advisor_id text not null,
  user_id text not null,
  display_name text not null default '',
  email text not null default '',
  ip_address text not null default '',
  user_agent text not null default '',
  device_label text not null default '',
  session_key text not null,
  logged_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists ora_advisor_login_session_idx on ora_advisor_login_ips (session_key);
create index if not exists ora_advisor_login_advisor_idx on ora_advisor_login_ips (advisor_id, logged_in_at desc);
create index if not exists ora_advisor_login_ip_idx on ora_advisor_login_ips (ip_address);

create table if not exists ora_shared_ip_alerts (
  fingerprint text primary key,
  report_id text not null,
  ip_address text not null,
  created_at timestamptz not null default now()
);
