import { getRequest } from "@tanstack/react-start/server";
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
  if (!canBootstrapOwnerAccount({ configuredEmail: configured, email, password })) {
    return { ok: false as const };
  }
  const sql = await getSql();
  await ensureAdminsTable();
  let userId = "";
  try {
    const [row] = await sql<{ id: string }>`select id from "user" where email = ${email}`;
    userId = row?.id || "";
  } catch {
    userId = "";
  }
  if (!userId) {
    const req = getRequest();
    const result = await auth.api.signUpEmail({
      body: { email, password, name: "Owner" },
      headers: req?.headers,
    });
    userId = result?.user?.id || "";
  }
  if (!userId) return { ok: false as const };
  await ensureAccount(userId, await authName(userId).catch(() => "Owner"));
  await bindDesignatedOwnerFromEnv(userId);
  return { ok: true as const };
}
