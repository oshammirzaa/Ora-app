alter table ora_ai_reports add column if not exists link_id text not null default '';

alter table ora_messages add column if not exists delivered_at timestamptz;
alter table ora_messages add column if not exists seen_at timestamptz;

alter table ora_advisor_inbox_messages add column if not exists delivered_at timestamptz;
alter table ora_advisor_inbox_messages add column if not exists seen_at timestamptz;
