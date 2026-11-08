create table if not exists ora_earnings_rank (
  advisor_id text primary key,
  eligible_cents integer not null default 0,
  rank integer,
  reached_at timestamptz,
  computed_at timestamptz not null default now()
);

create table if not exists ora_recommended_picks (
  state text not null,
  slot integer not null,
  advisor_id text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (state, slot)
);

create unique index if not exists ora_recommended_picks_advisor_idx
  on ora_recommended_picks (state, advisor_id);
