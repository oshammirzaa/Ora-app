import { getSql } from "@/lib/db";

let ready = false;

export async function ensureChatMediaColumns() {
  if (ready) return;
  const sql = await getSql();
  const statements = [
    "alter table ora_advisor_inbox_messages add column if not exists image_url text",
    "alter table ora_messages add column if not exists image_url text",
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[ora] chat media schema", err);
    }
  }
  ready = true;
}
