create table if not exists ora_customer_blocks (
  customer_id text not null,
  advisor_id text not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, advisor_id)
);

create index if not exists ora_customer_blocks_adv_idx
  on ora_customer_blocks (advisor_id, created_at desc);

alter table ora_advisor_reports add column if not exists reporter_user_id text not null default '';
alter table ora_advisor_reports add column if not exists reported_user_id text not null default '';
alter table ora_advisor_reports add column if not exists reporter_role text not null default 'advisor';
alter table ora_advisor_reports add column if not exists reading_id text not null default '';
alter table ora_advisor_reports add column if not exists admin_note text not null default '';
alter table ora_advisor_reports add column if not exists reviewed_at timestamptz;
alter table ora_advisor_reports add column if not exists resolved_at timestamptz;
alter table ora_advisor_reports add column if not exists resolved_by text not null default '';

create index if not exists ora_advisor_reports_reporter_idx
  on ora_advisor_reports (reporter_user_id, created_at desc);
