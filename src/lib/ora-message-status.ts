export type MessageReceipt = "sent" | "delivered" | "seen";

export function messageReceipt(input: { deliveredAt?: string | null; seenAt?: string | null }): MessageReceipt {
  if (input.seenAt) return "seen";
  if (input.deliveredAt) return "delivered";
  return "sent";
}

/** Admin and view-as sessions are not the recipient, so they cannot mark Seen. */
export function viewerMayMarkSeen(input: {
  viewerId: string;
  customerId: string;
  advisorUserId: string;
  adminView: boolean;
}) {
  if (input.adminView || !input.viewerId) return false;
  return input.viewerId === input.customerId || input.viewerId === input.advisorUserId;
}

export function receiptSqlChangesMoney(sql: string) {
  return /\b(insert\s+into|ora_wallets|ora_ledger|coins)\b/i.test(sql);
}

export const MARK_READING_SEEN = `update ora_messages
set delivered_at = coalesce(delivered_at, now()), seen_at = coalesce(seen_at, now())
where reading_id = $1 and role = $2 and seen_at is null`;

export const MARK_READING_DELIVERED_FOR_ADVISOR = `update ora_messages m
set delivered_at = coalesce(m.delivered_at, now())
from ora_readings r
join ora_advisors a on a.id = r.advisor_id
where m.reading_id = r.id and a.user_id = $1 and r.status = 'live' and m.role = 'client' and m.delivered_at is null`;

export const MARK_READING_DELIVERED_FOR_CUSTOMER = `update ora_messages m
set delivered_at = coalesce(m.delivered_at, now())
from ora_readings r
where m.reading_id = r.id and r.client_id = $1 and r.status = 'live' and m.role = 'advisor' and m.delivered_at is null`;

export const MARK_INBOX_DELIVERED_FOR_CUSTOMER = `update ora_advisor_inbox_messages
set delivered_at = coalesce(delivered_at, now())
where customer_id = $1 and role = 'advisor' and delivered_at is null`;

export const MARK_INBOX_DELIVERED_FOR_ADVISOR = `update ora_advisor_inbox_messages m
set delivered_at = coalesce(m.delivered_at, now())
from ora_advisors a
where m.advisor_id = a.id and a.user_id = $1 and m.role = 'customer' and m.delivered_at is null`;

export const MARK_INBOX_SEEN_FOR_CUSTOMER = `update ora_advisor_inbox_messages
set delivered_at = coalesce(delivered_at, now()), seen_at = coalesce(seen_at, now())
where thread_id = $1 and customer_id = $2 and role = 'advisor' and seen_at is null`;

export const MARK_INBOX_SEEN_FOR_ADVISOR = `update ora_advisor_inbox_messages m
set delivered_at = coalesce(m.delivered_at, now()), seen_at = coalesce(m.seen_at, now())
from ora_advisors a
where m.advisor_id = a.id and a.user_id = $1 and m.thread_id = $2 and m.role = 'customer' and m.seen_at is null`;
