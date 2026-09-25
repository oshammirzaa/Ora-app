export type ComplianceQuery = (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>;

export type ComplianceIncidentInput = {
  id: string;
  advisorId: string;
  customerId: string;
  conversationId: string;
  kind: string;
  sender: string;
  category: string;
  risk: string;
  confidence: number;
  excerpt: string;
  contextJson: string;
  blocked: boolean;
  warning: string;
};

const CONTACT = ["personal_info", "off_platform", "advisor_disclosure", "external_payment"];

export async function storeComplianceIncident(query: ComplianceQuery, input: ComplianceIncidentInput) {
  const dup = await query(
    `select id from ora_ai_reports
     where advisor_id = $1 and customer_id = $2 and category = $3 and excerpt = $4
       and created_at > now() - interval '15 minutes'
     limit 1`,
    [input.advisorId, input.customerId, input.category, input.excerpt],
  );
  if (dup[0]?.id) return { id: String(dup[0].id), created: false, linkedTo: "" };
  let linkedTo = "";
  if (CONTACT.includes(input.category)) {
    const prior = await query(
      `select id from ora_ai_reports
       where advisor_id = $1 and customer_id = $2 and conversation_id = $3
         and category in ('personal_info', 'off_platform', 'advisor_disclosure', 'external_payment')
         and status in ('new', 'reviewing')
         and created_at > now() - interval '2 hours'
       order by created_at asc
       limit 1`,
      [input.advisorId, input.customerId, input.conversationId],
    );
    linkedTo = prior[0]?.id ? String(prior[0].id) : "";
  }
  await query(
    `insert into ora_ai_reports (
      id, advisor_id, customer_id, conversation_id, conversation_kind, message_id, category, sender,
      risk, confidence, status, excerpt, context_json, blocked, warning, link_id
    ) values (
      $1, $2, $3, $4, $5, '', $6, $7,
      $8, $9, 'new', $10, $11, $12, $13, $14
    )`,
    [
      input.id,
      input.advisorId,
      input.customerId,
      input.conversationId,
      input.kind,
      input.category,
      input.sender,
      input.risk,
      input.confidence,
      input.excerpt,
      input.contextJson,
      input.blocked,
      input.warning,
      linkedTo,
    ],
  );
  return { id: input.id, created: true, linkedTo };
}

export const SOCIAL_NOTICE_TITLE = "New AI Safety Report: possible off-platform contact exchange";

export async function storeSocialAdminNotice(
  query: ComplianceQuery,
  input: {
    id: string;
    reportId: string;
    advisorName: string;
    customerName: string;
    sender: string;
    platform: string;
    risk: string;
  },
) {
  const risk = input.risk === "high" || input.risk === "low" ? input.risk : "medium";
  await query(
    `insert into ora_admin_notices (
      id, report_id, title, advisor_name, customer_name, sender, platform, risk
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    on conflict (report_id) do nothing`,
    [
      input.id,
      input.reportId,
      SOCIAL_NOTICE_TITLE,
      String(input.advisorName || "Advisor").slice(0, 80),
      String(input.customerName || "Client").slice(0, 80),
      input.sender === "advisor" ? "advisor" : "customer",
      String(input.platform || "Off-platform").slice(0, 40),
      risk,
    ],
  );
}

export async function attachComplianceMessageId(query: ComplianceQuery, reportId: string, messageId: string) {
  if (!reportId || !messageId) return;
  await query(`update ora_ai_reports set message_id = $2 where id = $1 and message_id = ''`, [reportId, messageId]);
}
