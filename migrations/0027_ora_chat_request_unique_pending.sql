-- One pending live-chat request per customer + advisor.
-- Prevents duplicate incoming alerts from double taps or racing Chat Now clicks.

update ora_chat_requests a
set status = 'expired'
where a.status = 'pending'
  and exists (
    select 1
    from ora_chat_requests b
    where b.status = 'pending'
      and b.advisor_id = a.advisor_id
      and b.client_id = a.client_id
      and (
        b.created_at < a.created_at
        or (b.created_at = a.created_at and b.id < a.id)
      )
  );

create unique index if not exists ora_chat_requests_pending_unique
  on ora_chat_requests (advisor_id, client_id)
  where status = 'pending';
