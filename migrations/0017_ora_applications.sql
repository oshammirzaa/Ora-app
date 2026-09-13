-- Advisor applications: extra applicant details. Additive only.

alter table ora_applications add column if not exists email text not null default '';
alter table ora_applications add column if not exists phone text not null default '';
alter table ora_applications add column if not exists country text not null default '';
alter table ora_applications add column if not exists availability text not null default '';
alter table ora_applications add column if not exists decided_at timestamptz;
alter table ora_applications add column if not exists decided_by text not null default '';

alter table ora_advisors add column if not exists phone text not null default '';
alter table ora_advisors add column if not exists country text not null default '';
alter table ora_advisors add column if not exists availability text not null default '';

create index if not exists ora_applications_user_idx on ora_applications (user_id, created_at desc);
