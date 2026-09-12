-- Recovery if 0013 never landed on Neon. Idempotent; does not drop data.
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

alter table ora_monthly_rank add column if not exists created_at timestamptz not null default now();
alter table ora_monthly_rank add column if not exists updated_at timestamptz not null default now();
alter table ora_monthly_rank add column if not exists computed_at timestamptz not null default now();
alter table ora_monthly_rank add column if not exists eligible boolean not null default false;
alter table ora_monthly_rank add column if not exists rank integer;
alter table ora_monthly_rank add column if not exists eligible_free_clients integer not null default 0;
alter table ora_monthly_rank add column if not exists converted_paid_clients integer not null default 0;
alter table ora_monthly_rank add column if not exists conversion_rate numeric(6,4) not null default 0;
alter table ora_monthly_rank add column if not exists paid_session_revenue integer not null default 0;

create index if not exists ora_monthly_rank_month_rank_idx
  on ora_monthly_rank (month, rank);

create index if not exists ora_readings_advisor_started_idx
  on ora_readings (advisor_id, started_at);
