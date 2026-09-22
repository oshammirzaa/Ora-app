alter table ora_advisors add column if not exists away boolean not null default false;
alter table ora_advisors add column if not exists schedule_tz text not null default '';
alter table ora_advisors add column if not exists hours_json text not null default '';
