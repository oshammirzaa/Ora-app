create table if not exists ora_ai_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  conversation_id text not null default '',
  conversation_kind text not null default 'reading',
  message_id text not null default '',
  category text not null,
  sender text not null,
  risk text not null,
  confidence numeric not null default 0,
  status text not null default 'new',
  excerpt text not null default '',
  context_json text not null default '',
  blocked boolean not null default false,
  warning text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text not null default ''
);
create index if not exists ora_ai_reports_status_idx on ora_ai_reports (status, created_at desc);

create table if not exists ora_ai_report_audit (
  id text primary key,
  report_id text not null,
  admin_id text not null,
  action text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table ora_profiles add column if not exists age_confirmed_at timestamptz;
