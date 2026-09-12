import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { env } from "@/lib/env.server";
import { auditLog, authName, ensureAccount, grantAdmin } from "@/lib/ora";
import {
  canBootstrapOwnerAccount,
  normalizeOwnerEmail,
  shouldDesignateOwner,
} from "@/lib/ora-admin-auth";

const OWNER_EMAIL_STATIC = process.env.ORA_OWNER_EMAIL;

export function designatedOwnerEmail() {
  return (env("ORA_OWNER_EMAIL") || OWNER_EMAIL_STATIC || "").trim();
}

async function ensureAdminsTable() {
  const sql = await getSql();
  await sql`
    create table if not exists ora_admins (
      user_id text primary key,
      email text not null default '',
      role text not null default 'admin',
      permissions text not null default '*',
      created_at timestamptz not null default now(),
      created_by text not null default ''
    )
  `;
}

async function findUserIdByEmail(email: string) {
  const sql = await getSql();
  try {
    const [row] = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${email} limit 1
    `;
    return row?.id || "";
  } catch {
    return "";
  }
}

export async function bindDesignatedOwnerFromEnv(userId: string) {
  const configured = designatedOwnerEmail();
  const sql = await getSql();
  await ensureAdminsTable();
  let email = "";
  try {
    const [authUser] = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
    email = authUser?.email || "";
  } catch {
    email = "";
  }
  if (!email) {
    const [profile] = await sql<{ email: string }>`select email from ora_profiles where user_id = ${userId}`;
    email = profile?.email || "";
  }
  const [existing] = await sql<{ user_id: string }>`
    select user_id from ora_admins where user_id = ${userId}
  `;
  if (!shouldDesignateOwner({ configuredEmail: configured, userEmail: email, alreadyOnRoster: Boolean(existing) })) {
    return false;
  }
  await grantAdmin(userId, userId, "owner");
  try {
    await auditLog(userId, "designate_owner", "profile", userId, "ORA_OWNER_EMAIL");
  } catch (e) {
    console.error("[ora] designate_owner audit failed", e);
  }
  return true;
}

export async function bootstrapDesignatedOwner(input: { email?: string; password?: string }) {
  const configured = designatedOwnerEmail();
  const email = normalizeOwnerEmail(input.email);
  const password = String(input.password || "");
  if (!configured) {
    console.error("[ora] ORA_OWNER_EMAIL is not visible to the server runtime");
    return { ok: false as const };
  }
  if (!canBootstrapOwnerAccount({ configuredEmail: configured, email, password })) {
    return { ok: false as const };
  }
  await ensureAdminsTable();
  let userId = await findUserIdByEmail(email);
  if (!userId) {
    try {
      // Do not pass the /_serverFn Request. Better Auth signUpEmail uses
      // formCsrfMiddleware + cloneRequest, so the seroval server-fn body would
      // fail origin/CSRF/body parse and abort owner creation.
      const result = await auth.api.signUpEmail({
        body: { email, password, name: "Owner" },
      });
      userId = result?.user?.id || "";
    } catch (e) {
      console.error("[ora] designated owner signup", e instanceof Error ? e.message : e);
      userId = await findUserIdByEmail(email);
    }
  }
  if (!userId) return { ok: false as const };
  await ensureAccount(userId, await authName(userId).catch(() => "Owner"));
  await bindDesignatedOwnerFromEnv(userId);
  return { ok: true as const };
}
