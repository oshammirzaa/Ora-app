import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { classifyCompliance, detectedSocialPlatform, shouldBlockCompliance } from "./ora-compliance.ts";
import { SOCIAL_NOTICE_TITLE, storeComplianceIncident, storeSocialAdminNotice, type ComplianceQuery } from "./ora-compliance-store.ts";

const REPORTS = `
create table ora_ai_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  conversation_id text not null default '',
  conversation_kind text not null default 'reading',
  message_id text not null default '',
  category text not null,
  sender text not null,
  risk text not null,
  confidence numeric not null default 0,
  status text not null default 'new',
  excerpt text not null default '',
  context_json text not null default '',
  blocked boolean not null default false,
  warning text not null default '',
  link_id text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists ora_admin_notices (
  id text primary key,
  report_id text not null unique,
  title text not null,
  advisor_name text not null default '',
  customer_name text not null default '',
  sender text not null default '',
  platform text not null default '',
  risk text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);
`;

function scannedBeforeSave(file: string, marker: string, insertAt: string) {
  const text = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = text.indexOf(marker);
  assert.ok(start >= 0, marker);
  const slice = text.slice(start, start + 6000);
  const scan = slice.indexOf("screenOutgoingMessage");
  const save = slice.indexOf(insertAt);
  assert.ok(scan >= 0, `${marker} calls the scanner`);
  assert.ok(save > scan, `${marker} scans before ${insertAt}`);
}

async function record(query: ComplianceQuery, body: string, sender: "customer" | "advisor", kind: "reading" | "message", id: string) {
  const hit = classifyCompliance({ body, sender });
  assert.ok(hit, body);
  const stored = await storeComplianceIncident(query, {
    id,
    advisorId: "adv_test",
    customerId: "cust_test",
    conversationId: kind === "reading" ? "read_1" : "adv_test:cust_test",
    kind,
    sender,
    category: hit.category,
    risk: hit.risk,
    confidence: hit.confidence,
    excerpt: body,
    contextJson: "[]",
    blocked: shouldBlockCompliance(hit),
    warning: hit.warning,
  });
  return stored;
}

describe("compliance on the real send pipeline", () => {
  it("scans live chat and inbox before the message is saved", () => {
    scannedBeforeSave("./ora.ts", "export const sendMessage", "insert into ora_messages");
    scannedBeforeSave("./ora.ts", "export const sendAdvisorMessage", "insert into ora_messages");
    scannedBeforeSave("./ora-paid-messages-api.ts", "export const sendCustomerInboxMessage", "insertCustomerMessage");
    scannedBeforeSave("./ora-advisor-desk.ts", "async function postAdvisorClientMessage", "insert into ora_advisor_inbox_messages");
    const paid = readFileSync(new URL("./ora-paid-messages-api.ts", import.meta.url), "utf8");
    const insert = paid.slice(paid.indexOf("async function insertCustomerMessage"));
    assert.match(insert, /insert into ora_advisor_inbox_messages/);
    assert.doesNotMatch(readFileSync(new URL("./ora-compliance-api.ts", import.meta.url), "utf8"), /XAI_API_KEY\s*=\s*["'][^"']+/);
  });

  it("persists the Facebook exchange for live chat and inbox", async () => {
    const db = new PGlite();
    await db.exec(REPORTS);
    const query: ComplianceQuery = async (text, params) => (await db.query(text, params)).rows as Array<Record<string, unknown>>;
    const liveCustomer = await record(query, "Can I have your Facebook?", "customer", "reading", "air_live_c");
    const liveAdvisor = await record(query, "Find me on Facebook as Test Advisor", "advisor", "reading", "air_live_a");
    const inboxCustomer = await record(query, "Can we talk on WhatsApp?", "customer", "message", "air_in_c");
    const inboxAdvisor = await record(query, "Find me on Instagram @testuser", "advisor", "message", "air_in_a");
    assert.equal(liveCustomer.created, true);
    assert.equal(liveAdvisor.linkedTo, liveCustomer.id);
    assert.equal(inboxAdvisor.linkedTo, inboxCustomer.id);

    const rows = await query(
      `select id, advisor_id, customer_id, conversation_id, conversation_kind, sender, category, risk, status, excerpt
       from ora_ai_reports order by created_at asc, id asc`,
    );
    assert.equal(rows.length, 4);
    assert.deepEqual(
      rows.map((row) => row.status),
      ["new", "new", "new", "new"],
    );
    assert.equal(rows[0]?.sender, "customer");
    assert.equal(rows[0]?.category, "off_platform");
    assert.equal(rows[0]?.conversation_kind, "reading");
    assert.equal(rows[1]?.sender, "advisor");
    assert.equal(rows[1]?.excerpt, "Find me on Facebook as Test Advisor");
    assert.equal(rows[2]?.conversation_kind, "message");
    assert.equal(rows[3]?.category, "off_platform");
    assert.equal(
      classifyCompliance({ body: "My ex blocked me on Facebook", sender: "customer" }),
      null,
    );
    assert.equal(
      classifyCompliance({ body: "You said your ex blocked you on Facebook", sender: "advisor" }),
      null,
    );
    assert.equal(classifyCompliance({ body: "My doctor changed my medication", sender: "customer" }), null);
    const minor = classifyCompliance({ body: "I am 16", sender: "customer" });
    assert.equal(minor?.category, "under_18");
    assert.equal(minor?.risk, "high");
    assert.equal(minor?.stopReading, true);
    assert.equal(classifyCompliance({ body: "My daughter is 16", sender: "customer" }), null);
  });

  it("stores social reports for live chat and inbox and notifies without the message text", async () => {
    const db = new PGlite();
    await db.exec(REPORTS);
    const query: ComplianceQuery = async (text, params) => (await db.query(text, params)).rows as Array<Record<string, unknown>>;
    const cases = [
      { body: "Can I have your Facebook?", sender: "customer" as const, kind: "reading" as const, id: "air_fb_c" },
      { body: "Find me on Facebook as John Smith", sender: "advisor" as const, kind: "reading" as const, id: "air_fb_a" },
      { body: "What's your Snapchat?", sender: "customer" as const, kind: "message" as const, id: "air_snap" },
      { body: "My Instagram is @testuser", sender: "advisor" as const, kind: "message" as const, id: "air_ig" },
      { body: "Can we talk on TikTok?", sender: "customer" as const, kind: "reading" as const, id: "air_tt" },
    ];
    for (const item of cases) {
      const stored = await record(query, item.body, item.sender, item.kind, item.id);
      assert.equal(stored.created, true, item.body);
      await storeSocialAdminNotice(query, {
        id: `ntc_${item.id}`,
        reportId: stored.id,
        advisorName: "Advisor One",
        customerName: "Client One",
        sender: item.sender,
        platform: detectedSocialPlatform(item.body) || "Off-platform",
        risk: item.sender === "advisor" ? "high" : "medium",
      });
    }
    assert.equal(classifyCompliance({ body: "My ex blocked me on Facebook", sender: "customer" }), null);
    assert.equal(classifyCompliance({ body: "She posted something on TikTok", sender: "customer" }), null);
    const reports = await query(`select id, status, category, conversation_kind from ora_ai_reports order by id`);
    assert.equal(reports.length, 5);
    assert.ok(reports.every((row) => row.status === "new" && row.category === "off_platform"));
    assert.ok(reports.some((row) => row.conversation_kind === "reading"));
    assert.ok(reports.some((row) => row.conversation_kind === "message"));
    const notices = await query(`select title, advisor_name, customer_name, sender, platform, risk, report_id from ora_admin_notices order by id`);
    assert.equal(notices.length, 5);
    const hidden = ["John Smith", "@testuser", "Snapchat?", "TikTok?"];
    for (const notice of notices) {
      assert.equal(notice.title, SOCIAL_NOTICE_TITLE);
      const blob = Object.values(notice).join(" ");
      for (const secret of hidden) assert.equal(blob.includes(secret), false, blob);
    }
    assert.equal(notices.find((row) => row.report_id === "air_fb_a")?.platform, "Facebook");
    assert.equal(notices.find((row) => row.report_id === "air_fb_a")?.sender, "advisor");
    assert.equal(notices.find((row) => row.report_id === "air_fb_a")?.risk, "high");
    const api = readFileSync(new URL("./ora-compliance-api.ts", import.meta.url), "utf8");
    assert.match(api, /storeSocialAdminNotice/);
    assert.match(api, /from ora_ai_reports/);
    assert.match(api, /adminSafetyNotices/);
    assert.doesNotMatch(api, /insert into ora_admin_notices[\s\S]{0,200}excerpt/);
  });
});
