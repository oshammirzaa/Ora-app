-- Speed up incoming-request client history summaries (this advisor + this client only).
create index if not exists ora_readings_advisor_client_completed_idx
  on ora_readings (advisor_id, client_id)
  where status in ('ended', 'completed');

create index if not exists ora_favorites_advisor_user_idx
  on ora_favorites (advisor_id, user_id);
