import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  ACCOUNT_DELETION_PHRASE,
  accountAccessBlock,
  deletionAttemptLimited,
  deletionCommand,
  deletionRequestAllowed,
  deleteCustomerAccountWith,
} from "./ora-account-deletion.ts";

const SCHEMA = `
create table "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create table "session" (
  id text primary key,
  "expiresAt" timestamptz not null default now(),
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "userId" text not null
);
create table "account" (
  id text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create table "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null default now()
);
create table ora_profiles (
  user_id text primary key,
  display_name text not null default '',
  role text not null default 'client',
  email text not null default '',
  gender text not null default '',
  date_of_birth text not null default '',
  status text not null default 'active',
  age_confirmed_at timestamptz
);
create table ora_admins (user_id text primary key, email text not null default '');
create table ora_advisors (id text primary key, user_id text not null, name text not null default '', email text not null default '');
create table ora_wallets (
  user_id text primary key,
  coins integer not null default 0,
  subscribed boolean not null default false
);
create table ora_password_resets (id text primary key, user_id text not null, token_hash text not null);
create table ora_readings (
  id text primary key,
  client_id text not null,
  advisor_id text not null default '',
  status text not null default 'ended',
  ended_at timestamptz
);
create table ora_messages (
  id text primary key,
  reading_id text not null,
  role text not null,
  body text not null,
  image_url text
);
create table ora_advisor_inbox (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  last_body text not null default ''
);
create table ora_advisor_inbox_messages (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  body text not null,
  image_url text
);
create table ora_advisor_notes (advisor_id text not null, customer_id text not null, body text not null default '', primary key (advisor_id, customer_id));
create table ora_advisor_note_entries (id text primary key, advisor_id text not null, customer_id text not null, body text not null);
create table ora_advisor_reminders (id text primary key, advisor_id text not null, customer_id text not null, note text not null default '');
create table ora_advisor_reports (
  id text primary key,
  advisor_id text not null,
  customer_id text not null,
  body text not null default '',
  reporter_user_id text not null default ''
);
create table ora_applications (
  id text primary key,
  user_id text not null,
  name text not null default '',
  legal_name text not null default '',
  email text not null default '',
  phone text not null default '',
  country text not null default '',
  bio text not null default '',
  experience text not null default '',
  photo_url text not null default '',
  video_url text not null default '',
  availability text not null default ''
);
create table ora_favorites (user_id text not null, advisor_id text not null, primary key (user_id, advisor_id));
create table ora_customer_blocks (customer_id text not null, advisor_id text not null, primary key (customer_id, advisor_id));
create table ora_tickets (id text primary key, client_id text not null);
create table ora_ticket_messages (id text primary key, ticket_id text not null, author_id text not null, body text not null);
create table ora_ticket_notes (id text primary key, ticket_id text not null, author_id text not null, body text not null);
create table ora_ai_reports (
  id text primary key,
  customer_id text not null,
  category text not null,
  excerpt text not null default '',
  context_json text not null default '',
  created_at timestamptz not null default now()
);
create table ora_advisor_login_ips (
  id text primary key,
  user_id text not null,
  display_name text not null default '',
  email text not null default '',
  ip_address text not null default '',
  session_key text not null unique,
  logged_in_at timestamptz not null default now()
);
create table ora_chat_requests (id text primary key, client_id text not null, status text not null);
create table ora_owner_log (
  id text primary key,
  actor_id text not null,
  act text not null,
  target_type text not null default '',
  target_id text not null default '',
  body text not null default ''
);
create table ora_payments (
  id text primary key,
  user_id text not null,
  amount_cents integer not null,
  provider_ref text not null default '',
  created_at timestamptz not null default now()
);
create table ora_ledger (
  id text primary key,
  user_id text not null,
  amount_coins integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);
create table ora_customer_tips (id text primary key, customer_id text not null, created_at timestamptz not null default now());
create table ora_paid_messages (id text primary key, customer_id text not null, created_at timestamptz not null default now());
`;

function sqlFor(db: PGlite) {
  return {
    query: async <T>(text: string, params?: unknown[]) => (await db.query(text, params)).rows as T[],
  };
}

async function seedCustomer(db: PGlite, id: string, email: string) {
  await db.query(
    `insert into "user" (id, name, email, "emailVerified", image) values ($1, $2, $3, true, 'data:image/jpeg;base64,abc')`,
    [id, "Ada", email],
  );
  await db.query(
    `insert into ora_profiles (user_id, display_name, role, email, gender, date_of_birth, status) values ($1, 'Ada', 'client', $2, 'woman', '1990-01-01', 'active')`,
    [id, email],
  );
  await db.query(`insert into "session" (id, token, "userId") values ($1, $2, $3)`, [`s-${id}`, `t-${id}`, id]);
  await db.query(
    `insert into "account" (id, "accountId", "providerId", "userId", password) values ($1, $1, 'credential', $1, 'hash')`,
    [id],
  );
  await db.query(`insert into "verification" (id, identifier, value) values ($1, $2, 'token')`, [`v-${id}`, email]);
  await db.query(`insert into ora_wallets (user_id, coins, subscribed) values ($1, 40, true)`, [id]);
  await db.query(`insert into ora_readings (id, client_id, status) values ($1, $2, 'live')`, [`r-${id}`, id]);
  await db.query(
    `insert into ora_messages (id, reading_id, role, body, image_url) values ($1, $2, 'client', 'secret note', 'data:image/jpeg;base64,msg')`,
    [`m-${id}`, `r-${id}`],
  );
  await db.query(
    `insert into ora_payments (id, user_id, amount_cents, provider_ref) values ($1, $2, 1000, 'pi_recent')`,
    [`pay-${id}`, id],
  );
  await db.query(`insert into ora_ledger (id, user_id, amount_coins, note) values ($1, $2, 40, 'coin purchase')`, [`led-${id}`, id]);
  await db.query(
    `insert into ora_ai_reports (id, customer_id, category, excerpt, context_json) values ($1, $2, 'off_platform', 'call me', '["call me"]')`,
    [`ai-${id}`, id],
  );
}

describe("account deletion", () => {
  it("requires two confirmations and ignores a client user id", () => {
    const command = deletionCommand({ acknowledged: true, confirmation: " DELETE ", userId: "someone-else" });
    assert.equal(command.acknowledged, true);
    assert.equal(command.confirmation, "DELETE");
    assert.equal("userId" in command, false);
    assert.equal(deletionRequestAllowed({ acknowledged: false, confirmation: ACCOUNT_DELETION_PHRASE }), false);
    assert.equal(deletionRequestAllowed({ acknowledged: true, confirmation: "delete" }), false);
    assert.equal(deletionRequestAllowed(command), true);
    assert.equal(deletionAttemptLimited(5), false);
    assert.equal(deletionAttemptLimited(6), true);
    assert.equal(accountAccessBlock("deleted"), "This account is closed.");
    assert.equal(accountAccessBlock("active"), "");
  });

  it("deletes only the signed-in customer and keeps financial records", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await seedCustomer(db, "user-a", "ada@example.com");
    await seedCustomer(db, "user-b", "bea@example.com");
    await db.exec(`insert into ora_favorites (user_id, advisor_id) values ('user-a', 'adv')`);
    await db.exec(`insert into ora_applications (id, user_id, legal_name, email, phone, photo_url) values ('app-a', 'user-a', 'Ada Legal', 'ada@example.com', '555', 'data:image/jpeg;base64,app')`);
    await db.exec(`insert into ora_payments (id, user_id, amount_cents, created_at) values ('pay-old', 'user-a', 500, now() - interval '8 years')`);
    const sql = sqlFor(db);

    await assert.rejects(
      () => deleteCustomerAccountWith(sql, "user-a", { acknowledged: true, confirmation: "nope", userId: "user-b" }),
      /Type DELETE/,
    );
    const kept = await db.query<{ email: string }>(`select email from "user" where id = 'user-a'`);
    assert.equal(kept.rows[0].email, "ada@example.com");

    const result = await deleteCustomerAccountWith(sql, "user-a", {
      acknowledged: true,
      confirmation: "DELETE",
      userId: "user-b",
    });
    assert.equal(result.ok, true);
    assert.equal(result.already, false);

    const user = await db.query<{ name: string; email: string; image: string | null }>(`select name, email, image from "user" where id = 'user-a'`);
    assert.equal(user.rows[0].name, "Deleted member");
    assert.equal(user.rows[0].image, null);
    assert.doesNotMatch(user.rows[0].email, /ada@example.com/);
    const profile = await db.query<{ display_name: string; email: string; gender: string; date_of_birth: string; status: string }>(
      `select display_name, email, gender, date_of_birth, status from ora_profiles where user_id = 'user-a'`,
    );
    assert.equal(profile.rows[0].status, "deleted");
    assert.equal(profile.rows[0].email, "");
    assert.equal(profile.rows[0].gender, "");
    assert.equal(profile.rows[0].date_of_birth, "");
    const sessions = await db.query(`select id from "session" where "userId" = 'user-a'`);
    assert.equal(sessions.rows.length, 0);
    const accounts = await db.query(`select id from "account" where "userId" = 'user-a'`);
    assert.equal(accounts.rows.length, 0);
    const message = await db.query<{ body: string; image_url: string }>(`select body, image_url from ora_messages where id = 'm-user-a'`);
    assert.equal(message.rows[0].body, "");
    assert.equal(message.rows[0].image_url, "");
    const payment = await db.query<{ amount_cents: number; provider_ref: string }>(`select amount_cents, provider_ref from ora_payments where id = 'pay-user-a'`);
    assert.equal(Number(payment.rows[0].amount_cents), 1000);
    assert.equal(payment.rows[0].provider_ref, "pi_recent");
    const oldPay = await db.query(`select id from ora_payments where id = 'pay-old'`);
    assert.equal(oldPay.rows.length, 0);
    const ledger = await db.query(`select id from ora_ledger where id = 'led-user-a'`);
    assert.equal(ledger.rows.length, 1);
    const report = await db.query<{ category: string; excerpt: string }>(`select category, excerpt from ora_ai_reports where id = 'ai-user-a'`);
    assert.equal(report.rows[0].category, "off_platform");
    assert.equal(report.rows[0].excerpt, "");
    const app = await db.query<{ legal_name: string; photo_url: string }>(`select legal_name, photo_url from ora_applications where id = 'app-a'`);
    assert.equal(app.rows[0].legal_name, "");
    assert.equal(app.rows[0].photo_url, "");
    const log = await db.query<{ body: string }>(`select body from ora_owner_log where actor_id = 'user-a'`);
    assert.equal(log.rows.length, 1);
    assert.doesNotMatch(log.rows[0].body, /ada@example.com|secret note/);
    const other = await db.query<{ email: string }>(`select email from "user" where id = 'user-b'`);
    assert.equal(other.rows[0].email, "bea@example.com");
    const otherMessage = await db.query<{ body: string }>(`select body from ora_messages where id = 'm-user-b'`);
    assert.equal(otherMessage.rows[0].body, "secret note");

    const again = await deleteCustomerAccountWith(sql, "user-a", { acknowledged: true, confirmation: "DELETE" });
    assert.equal(again.already, true);
    const still = await db.query(`select id from ora_payments where id = 'pay-user-a'`);
    assert.equal(still.rows.length, 1);
  });

  it("does not delete an advisor or another customer's rows", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await seedCustomer(db, "adv-user", "advisor@example.com");
    await db.exec(`update ora_profiles set role = 'advisor' where user_id = 'adv-user'`);
    await db.exec(`insert into ora_advisors (id, user_id, name, email) values ('adv1', 'adv-user', 'Ora Advisor', 'advisor@example.com')`);
    const sql = sqlFor(db);
    await assert.rejects(
      () => deleteCustomerAccountWith(sql, "adv-user", { acknowledged: true, confirmation: "DELETE" }),
      /Advisor accounts cannot be deleted/,
    );
    const email = await db.query<{ email: string }>(`select email from "user" where id = 'adv-user'`);
    assert.equal(email.rows[0].email, "advisor@example.com");
    const listing = await db.query(`select id from ora_advisors where user_id = 'adv-user'`);
    assert.equal(listing.rows.length, 1);
  });

  it("rate limits repeated deletion attempts", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA);
    await seedCustomer(db, "user-c", "cy@example.com");
    const sql = sqlFor(db);
    for (let i = 0; i < 5; i += 1) {
      await assert.rejects(
        () => deleteCustomerAccountWith(sql, "user-c", { acknowledged: true, confirmation: "NO" }),
        /Type DELETE/,
      );
    }
    await assert.rejects(
      () => deleteCustomerAccountWith(sql, "user-c", { acknowledged: true, confirmation: "DELETE" }),
      /Too many deletion attempts/,
    );
    const email = await db.query<{ email: string }>(`select email from "user" where id = 'user-c'`);
    assert.equal(email.rows[0].email, "cy@example.com");
  });
});
