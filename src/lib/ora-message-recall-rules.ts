export const RECALLED_THREAD_PREVIEW = "Message recalled";

/** Only the sender can recall, and only a real chat message — never a tip. */
export const RECALL_INBOX_SQL = `update ora_advisor_inbox_messages m
set recalled_at = now()
from ora_advisors a
where m.id = $1
  and a.id = m.advisor_id
  and m.recalled_at is null
  and coalesce(m.tip_gift, '') = ''
  and coalesce(m.kind, 'message') in ('message', 'followup')
  and (
    (m.role = 'customer' and m.customer_id = $2)
    or (m.role = 'advisor' and a.user_id = $2)
  )
returning m.id, m.thread_id`;

export const RECALL_READING_SQL = `update ora_messages m
set recalled_at = now()
from ora_readings r
left join ora_advisors a on a.id = r.advisor_id
where m.id = $1
  and m.reading_id = r.id
  and m.recalled_at is null
  and coalesce(m.tip_gift, '') = ''
  and (
    (m.role = 'client' and r.client_id = $2)
    or (m.role = 'advisor' and a.user_id = $2)
  )
returning m.id`;

/** Preview text only. Does not touch unread counts, last_at, or alerts. */
export const REFRESH_INBOX_PREVIEW_SQL = `update ora_advisor_inbox i
set last_body = $2
where i.id = $1
  and (
    select m.id
    from ora_advisor_inbox_messages m
    where m.thread_id = i.id
    order by m.created_at desc, m.id desc
    limit 1
  ) = $3`;

export function recallSqlChangesMoneyOrAlerts(sql: string) {
  return /\b(ora_wallets|ora_ledger|ora_paid_messages|ora_customer_alerts|unread_|coins|seconds)\b/i.test(sql);
}

export function publicMessageContent(input: { body?: unknown; image?: unknown; recalledAt?: unknown }) {
  const recalled = input.recalledAt != null && String(input.recalledAt).trim() !== "";
  return {
    recalled,
    body: recalled ? "" : String(input.body ?? ""),
    image: recalled ? "" : String(input.image ?? ""),
  };
}

export function applyLocalRecalls<T extends { id: string; body?: string; image?: string; recalled?: boolean }>(
  messages: T[],
  ids: { has: (id: string) => boolean },
): Array<T & { recalled?: boolean }> {
  return messages.map((message) => {
    if (!ids.has(message.id) || message.recalled) return message;
    return { ...message, body: "", image: "", recalled: true };
  });
}
