-- Atomic daily outreach quota for advisor-initiated inbox/follow-up messages.
-- Live paid reading chat stays in ora_messages and is not counted here.

create table if not exists ora_advisor_daily_messages (
  advisor_id text not null,
  day date not null,
  used integer not null default 0,
  primary key (advisor_id, day)
);

create index if not exists ora_advisor_inbox_daily_msg_idx
  on ora_advisor_inbox_messages (advisor_id, role, kind, created_at);
