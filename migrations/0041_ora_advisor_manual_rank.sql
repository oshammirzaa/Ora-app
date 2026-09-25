alter table ora_advisors add column if not exists manual_rank integer;

create unique index if not exists ora_advisors_manual_rank_uidx
  on ora_advisors (manual_rank)
  where manual_rank is not null;

create table if not exists ora_advisor_rank_history (
  id text primary key,
  advisor_id text not null,
  old_rank integer,
  new_rank integer,
  actor_id text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists ora_advisor_rank_history_created_idx
  on ora_advisor_rank_history (created_at desc);
