alter table ora_advisor_reminders add column if not exists notified_at timestamptz;
create index if not exists ora_advisor_reminders_due_idx
  on ora_advisor_reminders (advisor_id, due_at)
  where done_at is null;
