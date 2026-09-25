-- Current automatic Trusted Psychics board. One row per advisor, recalculated
-- from the rolling last 30 days. Older calendar months stay in ora_monthly_rank.
create table if not exists ora_trusted_window (
  advisor_id text primary key,
  window_start timestamptz not null,
  window_end timestamptz not null,
  eligible_free_clients integer not null default 0,
  converted_paid_clients integer not null default 0,
  paid_clients integer not null default 0,
  conversion_rate numeric(6,4) not null default 0,
  paid_session_revenue integer not null default 0,
  eligible boolean not null default false,
  rank integer,
  computed_at timestamptz not null default now()
);
