import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  MAY_NOTE_CLIENT_SQL,
  PRIVATE_NOTE_MAX,
  PRIVATE_NOTE_TABLE_SQL,
  advisorMayNoteClient,
  normalizePrivateNote,
  privateNoteSaved,
  readAdvisorPrivateNote,
  writeAdvisorPrivateNote,
  type NoteQuery,
} from "./ora-private-notes.ts";

const SCHEMA = `
${PRIVATE_NOTE_TABLE_SQL};
create table ora_chat_requests (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  status text not null
);
create table ora_readings (
  id text primary key,
  client_id text not null,
  advisor_id text not null,
  status text not null
);
create table ora_advisor_inbox (
  id text primary key,
  advisor_id text not null,
  customer_id text not null
);
`;

function queryFor(db: PGlite): NoteQuery {
  return async (text, params) => (await db.query(text, params)).rows as Array<Record<string, unknown>>;
}

describe("private advisor client notes", () => {
  it("keeps one note per advisor and client and hides the other advisor's note", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    const query = queryFor(db);
    await db.exec(`insert into ora_chat_requests (id, client_id, advisor_id, status) values ('req_a', 'client_1', 'adv_a', 'pending')`);
    assert.equal(await advisorMayNoteClient(query, "adv_a", "client_1"), true);
    assert.equal(await advisorMayNoteClient(query, "adv_b", "client_1"), false);
    assert.equal(await advisorMayNoteClient(query, "adv_a", "client_2"), false);

    const savedA = await writeAdvisorPrivateNote(query, "adv_a", "client_1", "only advisor A");
    await db.exec(`insert into ora_readings (id, client_id, advisor_id, status) values ('read_b', 'client_1', 'adv_b', 'live')`);
    const savedB = await writeAdvisorPrivateNote(query, "adv_b", "client_1", "only advisor B");
    assert.equal(savedA, "only advisor A");
    assert.equal(savedB, "only advisor B");
    assert.equal(await readAdvisorPrivateNote(query, "adv_a", "client_1"), "only advisor A");
    assert.equal(await readAdvisorPrivateNote(query, "adv_b", "client_1"), "only advisor B");
    assert.equal(await readAdvisorPrivateNote(query, "adv_a", "client_2"), "");

    await writeAdvisorPrivateNote(query, "adv_a", "client_1", "updated by A");
    assert.equal(await readAdvisorPrivateNote(query, "adv_a", "client_1"), "updated by A");
    assert.equal(await readAdvisorPrivateNote(query, "adv_b", "client_1"), "only advisor B");
    const rows = await query(`select advisor_id, customer_id, body from ora_advisor_notes order by advisor_id`);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.advisor_id, "adv_a");
    assert.equal(rows[1]?.advisor_id, "adv_b");
  });

  it("limits the note and only marks a real saved note", () => {
    assert.equal(normalizePrivateNote("  hello  ").trim(), "hello");
    assert.equal(normalizePrivateNote("x".repeat(PRIVATE_NOTE_MAX + 20)).length, PRIVATE_NOTE_MAX);
    assert.equal(privateNoteSaved("   "), false);
    assert.equal(privateNoteSaved("remember the sister"), true);
    assert.match(MAY_NOTE_CLIENT_SQL, /advisor_id = \$1/);
    assert.doesNotMatch(MAY_NOTE_CLIENT_SQL, /\$3/);
  });

  it("uses the signed-in advisor id on both screens and not a customer API", () => {
    const desk = readFileSync(new URL("./ora-advisor-desk.ts", import.meta.url), "utf8");
    const save = desk.slice(desk.indexOf("export const saveAdvisorPrivateNote"));
    assert.match(save, /advisorDesk\(context\.userId\)/);
    assert.match(save, /writeAdvisorPrivateNote\(query, advisor\.id, data\.customerId, data\.body\)/);
    assert.doesNotMatch(save.slice(0, 900), /advisorId:\s*input/);
    const read = desk.slice(desk.indexOf("export const getAdvisorPrivateNote"), desk.indexOf("export const saveAdvisorPrivateNote"));
    assert.match(read, /readAdvisorPrivateNote\(query, advisor\.id, data\.customerId\)/);
    const incoming = readFileSync(new URL("../components/incoming-request-alert.tsx", import.meta.url), "utf8");
    const session = readFileSync(new URL("../routes/advisor/session/$id.tsx", import.meta.url), "utf8");
    assert.match(incoming, /ClientNoteButton/);
    assert.match(session, /ClientNoteButton/);
    assert.equal(incoming.includes("stopLiveChatVoice"), true);
    const customer = readFileSync(new URL("./ora.ts", import.meta.url), "utf8");
    assert.doesNotMatch(customer, /ora_advisor_notes/);
    assert.doesNotMatch(customer, /getAdvisorPrivateNote|saveAdvisorPrivateNote/);
  });
});
