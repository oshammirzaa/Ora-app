-- Customer opt-out of advisor outreach, plus a pair index for anti-spam checks.
-- Daily quota remains ora_advisor_daily_messages (UTC calendar day).

alter table ora_profiles
  add column if not exists outreach_opt_out boolean not null default false;

create index if not exists ora_advisor_inbox_outreach_pair_idx
  on ora_advisor_inbox_messages (advisor_id, customer_id, role, created_at);
