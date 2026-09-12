-- Monthly free-to-paid conversion ranking. History is kept per calendar month;
-- the current month is recalculated from ora_readings and upserted in place.
-- Additive only: never drops existing tables or rows.
create table if not exists ora_monthly_rank (
  month date not null,
  advisor_id text not null,
  eligible_free_clients integer not null default 0,
  converted_paid_clients integer not null default 0,
  conversion_rate numeric(6,4) not null default 0,
  paid_session_revenue integer not null default 0,
  eligible boolean not null default false,
  rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  computed_at timestamptz not null default now(),
  primary key (month, advisor_id)
);

create index if not exists ora_monthly_rank_month_rank_idx
  on ora_monthly_rank (month, rank);

create index if not exists ora_readings_advisor_started_idx
  on ora_readings (advisor_id, started_at);
