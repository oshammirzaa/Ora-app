-- Platform entities the owner dashboard reads: customers, advisors, sessions,
-- transactions, payouts, and admin users. Additive — existing ora_* tables stay.

alter table ora_advisors add column if not exists email text not null default '';

update ora_advisors a
set email = p.email
from ora_profiles p
where p.user_id = a.user_id
  and coalesce(p.email, '') <> ''
  and coalesce(a.email, '') = '';

update ora_advisors
set email = lower(replace(name, ' ', '.')) || '@advisors.ora'
where coalesce(email, '') = '';

create table if not exists ora_admins (
  user_id text primary key,
  email text not null default '',
  role text not null default 'admin',
  permissions text not null default '*',
  created_at timestamptz not null default now(),
  created_by text not null default ''
);

insert into ora_admins (user_id, email, role, permissions, created_by)
select user_id, email, 'owner', '*', user_id
from ora_profiles
where role = 'admin'
on conflict (user_id) do nothing;

create index if not exists ora_admins_email_idx on ora_admins (email);
create index if not exists ora_profiles_role_idx on ora_profiles (role);
create index if not exists ora_profiles_status_idx on ora_profiles (status);
create index if not exists ora_advisors_online_status_idx on ora_advisors (online, status);
create index if not exists ora_readings_status_idx on ora_readings (status);
create index if not exists ora_readings_started_idx on ora_readings (started_at desc);
create index if not exists ora_payouts_status_idx on ora_payouts (status);
create index if not exists ora_wallets_user_idx on ora_wallets (user_id);

drop view if exists ora_v_customers;
create view ora_v_customers as
select
  p.user_id as id,
  p.display_name as name,
  p.email,
  p.status as account_status,
  coalesce(w.coins, 0) as wallet_coins,
  p.created_at as signup_date
from ora_profiles p
left join ora_wallets w on w.user_id = p.user_id
where p.role = 'client';

drop view if exists ora_v_advisors;
create view ora_v_advisors as
select
  a.id,
  a.name,
  coalesce(nullif(a.email, ''), p.email, '') as email,
  a.bio as profile,
  a.specialties,
  a.rate_coins as rate_per_minute,
  a.online,
  case when a.online then 'online' else 'offline' end as presence,
  a.status as approval_status,
  a.payout_coins as earnings,
  a.created_at
from ora_advisors a
left join ora_profiles p on p.user_id = a.user_id;

drop view if exists ora_v_sessions;
create view ora_v_sessions as
select
  r.id,
  r.client_id as customer_id,
  r.advisor_id,
  r.started_at as start_time,
  r.ended_at as end_time,
  r.seconds as duration,
  r.coins_spent as cost,
  r.status
from ora_readings r;

drop view if exists ora_v_transactions;
create view ora_v_transactions as
select
  id,
  user_id,
  'coin_purchase'::text as kind,
  coins::int as amount_coins,
  amount_cents::int as amount_cents,
  status::text as status,
  created_at,
  ('pack ' || pack_id)::text as note
from ora_payments
union all
select
  id,
  user_id,
  kind::text,
  coins::int,
  0,
  'posted'::text,
  created_at,
  note::text
from ora_adjustments
union all
select
  id,
  user_id,
  'payout'::text,
  coins::int,
  coalesce(amount_cents, 0)::int,
  status::text,
  created_at,
  note::text
from ora_payouts;

drop view if exists ora_v_payouts;
create view ora_v_payouts as
select
  p.id,
  p.advisor_id,
  p.user_id,
  a.name as advisor_name,
  p.coins as amount,
  p.status,
  p.created_at as request_date,
  p.decided_at as decided_date
from ora_payouts p
join ora_advisors a on a.id = p.advisor_id;

drop view if exists ora_v_admin_users;
create view ora_v_admin_users as
select
  a.user_id,
  coalesce(nullif(a.email, ''), p.email, '') as email,
  a.role,
  a.permissions,
  a.created_at
from ora_admins a
left join ora_profiles p on p.user_id = a.user_id;
