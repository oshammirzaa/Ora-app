/** Owner support access. The admin session stays the admin session. The cookie is only a view-as id. */

import { getSql } from "@/lib/db";
import { advisorRatingFromReviews, matchesAdvisorQuery } from "@/lib/ora-advisor-admin-search";

export { advisorRatingFromReviews, matchesAdvisorQuery };

export const VIEW_AS_COOKIE = "ora_view_as";
const VIEW_AS_MAX_AGE = 60 * 60 * 4;

export type ViewAsSession = {
  id: string;
  adminId: string;
  advisorId: string;
  advisorUserId: string;
  advisorName: string;
  reason: string;
  startedAt: string;
};

let schemaReady = false;

export async function ensureViewAsSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  await sql.query(`create table if not exists ora_view_as (
    id text primary key,
    admin_id text not null,
    advisor_id text not null,
    advisor_user_id text not null default '',
    advisor_name text not null default '',
    reason text not null default '',
    started_at timestamptz not null default now(),
    ended_at timestamptz
  )`);
  await sql.query("create index if not exists ora_view_as_admin_idx on ora_view_as (admin_id, started_at desc)");
  await sql.query("alter table ora_reviews add column if not exists source text not null default 'customer'");
  await sql.query("alter table ora_reviews add column if not exists created_by text not null default ''");
  await sql.query("alter table ora_reviews add column if not exists client_label text not null default ''");
  await sql.query(`create table if not exists ora_review_audit (
    id text primary key,
    review_id text not null,
    advisor_id text not null,
    admin_id text not null,
    action text not null,
    before_json text not null default '',
    after_json text not null default '',
    created_at timestamptz not null default now()
  )`);
  schemaReady = true;
}

async function readCookie() {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    return String(getCookie(VIEW_AS_COOKIE) || "").slice(0, 80);
  } catch {
    return "";
  }
}

async function writeCookie(id: string) {
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(VIEW_AS_COOKIE, id, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: id ? VIEW_AS_MAX_AGE : 0,
  });
}

async function isAdmin(userId: string) {
  const sql = await getSql();
  const [row] = await sql<{ user_id: string }>`
    select user_id from ora_admins where user_id = ${userId} limit 1
  `.catch(() => []);
  return Boolean(row);
}

export async function currentViewAs(userId: string): Promise<ViewAsSession | null> {
  const cookie = await readCookie();
  if (!cookie || !userId) return null;
  try {
    await ensureViewAsSchema();
  } catch {
    return null;
  }
  if (!(await isAdmin(userId))) return null;
  const sql = await getSql();
  const [row] = await sql<{
    id: string;
    admin_id: string;
    advisor_id: string;
    advisor_user_id: string;
    advisor_name: string;
    reason: string;
    started_at: string;
  }>`
    select id, admin_id, advisor_id, advisor_user_id, advisor_name, reason, started_at::text as started_at
    from ora_view_as
    where id = ${cookie} and admin_id = ${userId} and ended_at is null
    limit 1
  `.catch(() => []);
  if (!row) return null;
  return {
    id: row.id,
    adminId: row.admin_id,
    advisorId: row.advisor_id,
    advisorUserId: row.advisor_user_id,
    advisorName: row.advisor_name,
    reason: row.reason || "",
    startedAt: String(row.started_at || ""),
  };
}

export async function deskUserId(realUserId: string) {
  const view = await currentViewAs(realUserId);
  return view?.advisorUserId || realUserId;
}

export async function assertOwnerViewIsReadOnly(userId: string) {
  const active = await currentViewAs(userId);
  if (!active) return;
  throw new Error(
    `This is locked while viewing as ${active.advisorName}. Exit to return to your admin account. Payouts, passwords, security settings, and billing stay unchanged.`,
  );
}

export async function beginViewAs(input: {
  adminId: string;
  advisorId: string;
  advisorUserId: string;
  advisorName: string;
  reason: string;
}) {
  await ensureViewAsSchema();
  const sql = await getSql();
  await sql`
    update ora_view_as set ended_at = now()
    where admin_id = ${input.adminId} and ended_at is null
  `;
  const id = `view_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const reason = input.reason.trim().slice(0, 300);
  await sql`
    insert into ora_view_as (id, admin_id, advisor_id, advisor_user_id, advisor_name, reason)
    values (${id}, ${input.adminId}, ${input.advisorId}, ${input.advisorUserId}, ${input.advisorName}, ${reason})
  `;
  await writeCookie(id);
  return { id, reason };
}

export async function finishViewAs(adminId: string) {
  await ensureViewAsSchema();
  const cookie = await readCookie();
  const sql = await getSql();
  const rows = await sql<{ id: string; advisor_id: string; advisor_name: string; started_at: string }>`
    update ora_view_as
    set ended_at = now()
    where admin_id = ${adminId} and ended_at is null
    returning id, advisor_id, advisor_name, started_at::text as started_at
  `;
  await writeCookie("");
  const match = rows.find((row) => row.id === cookie) || rows[0];
  return rows[0]
    ? {
        id: rows[0].id,
        advisorId: rows[0].advisor_id,
        advisorName: rows[0].advisor_name,
        startedAt: String(rows[0].started_at || ""),
      }
    : null;
}
