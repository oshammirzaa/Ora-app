import { getSql } from "@/lib/db";

let ready = 0;
const MEDIA_SCHEMA = 3;

export async function ensureChatMediaColumns() {
  if (ready >= MEDIA_SCHEMA) return;
  const sql = await getSql();
  const statements = [
    "alter table ora_advisor_inbox_messages add column if not exists image_url text",
    "alter table ora_messages add column if not exists image_url text",
    "alter table ora_advisor_inbox_messages add column if not exists tip_gift text",
    "alter table ora_messages add column if not exists tip_gift text",
    "alter table ora_messages add column if not exists delivered_at timestamptz",
    "alter table ora_messages add column if not exists seen_at timestamptz",
    "alter table ora_advisor_inbox_messages add column if not exists delivered_at timestamptz",
    "alter table ora_advisor_inbox_messages add column if not exists seen_at timestamptz",
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] chat media schema", err);
    }
  }
  ready = MEDIA_SCHEMA;
}
