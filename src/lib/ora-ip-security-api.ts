import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { requireAdmin, rid } from "@/lib/ora";
import {
  SHARED_IP_CATEGORY,
  cleanText,
  isPublicIp,
  latestAdvisorIps,
  newSharedFingerprints,
  normalizeIp,
  sharedIpClusters,
  sharedIpReportContext,
  sharedIpReportExcerpt,
  type LoginEvent,
} from "@/lib/ora-ip-security";

const SCHEMA = [
  `create table if not exists ora_advisor_login_ips (
    id text primary key,
    advisor_id text not null,
    user_id text not null,
    display_name text not null default '',
    email text not null default '',
    ip_address text not null default '',
    user_agent text not null default '',
    device_label text not null default '',
    session_key text not null,
    logged_in_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
  )`,
  "create unique index if not exists ora_advisor_login_session_idx on ora_advisor_login_ips (session_key)",
  "create index if not exists ora_advisor_login_advisor_idx on ora_advisor_login_ips (advisor_id, logged_in_at desc)",
  "create index if not exists ora_advisor_login_ip_idx on ora_advisor_login_ips (ip_address)",
  `create table if not exists ora_shared_ip_alerts (
    fingerprint text primary key,
    report_id text not null,
    ip_address text not null,
    created_at timestamptz not null default now()
  )`,
];

let schemaReady = false;

async function ensureIpSchema(sql: Sql) {
  if (schemaReady) return;
  for (const statement of SCHEMA) {
    await sql.query(statement);
  }
  schemaReady = true;
}

type AdvisorIdentity = { id: string; user_id: string; name: string; email: string };

async function loadLiveAdvisor(sql: Sql, userId: string) {
  try {
    const [row] = await sql<AdvisorIdentity>`
      select a.id, a.user_id, a.name,
             coalesce(nullif(u.email, ''), nullif(p.email, ''), '') as email
      from ora_advisors a
      left join "user" u on u.id = a.user_id
      left join ora_profiles p on p.user_id = a.user_id
      where a.user_id = ${userId} and a.status = 'live'
      limit 1
    `;
    return row ?? null;
  } catch {
    const [row] = await sql<AdvisorIdentity>`
      select id, user_id, name, '' as email
      from ora_advisors
      where user_id = ${userId} and status = 'live'
      limit 1
    `;
    return row ?? null;
  }
}

async function loadLoginEvents(sql: Sql) {
  const rows = await sql<{
    advisor_id: string;
    display_name: string;
    email: string;
    ip_address: string;
    device_label: string;
    user_agent: string;
    logged_in_at: string;
  }>`
    select advisor_id, display_name, email, ip_address, device_label, user_agent,
           to_char(logged_in_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as logged_in_at
    from ora_advisor_login_ips
    order by logged_in_at desc
    limit 8000
  `;
  return rows.map(
    (row): LoginEvent => ({
      advisorId: row.advisor_id,
      name: row.display_name,
      email: row.email,
      ip: normalizeIp(row.ip_address),
      at: row.logged_in_at,
      device: row.device_label,
      userAgent: row.user_agent,
    }),
  );
}

async function syncSharedIpReports(sql: Sql) {
  const events = await loadLoginEvents(sql);
  const clusters = sharedIpClusters(events);
  if (!clusters.length) return;
  const known = await sql<{ fingerprint: string }>`select fingerprint from ora_shared_ip_alerts`;
  const fresh = newSharedFingerprints(
    known.map((row) => row.fingerprint),
    clusters,
  );
  if (!fresh.length) return;
  const { ensureComplianceSchema } = await import("@/lib/ora-compliance-api");
  await ensureComplianceSchema();
  for (const cluster of fresh) {
    const reportId = rid("air");
    const inserted = await sql<{ fingerprint: string }>`
      insert into ora_shared_ip_alerts (fingerprint, report_id, ip_address)
      values (${cluster.fingerprint}, ${reportId}, ${cluster.ip})
      on conflict (fingerprint) do nothing
      returning fingerprint
    `;
    if (!inserted.length) continue;
    try {
      const primary = cluster.accounts[0]?.advisorId || "";
      await sql`
        insert into ora_ai_reports (
          id, advisor_id, customer_id, conversation_id, conversation_kind, message_id, category, sender,
          risk, confidence, status, excerpt, context_json, blocked, warning, link_id
        ) values (
          ${reportId}, ${primary}, '', ${`shared-ip:${cluster.ip}`}, 'security', '',
          ${SHARED_IP_CATEGORY}, 'advisor',
          'low', 0.4, 'new', ${sharedIpReportExcerpt(cluster)}, ${JSON.stringify(sharedIpReportContext(cluster))},
          false, ${"Report only. No advisor was suspended, banned, blocked, or reranked."}, ''
        )
      `;
    } catch (err) {
      await sql`delete from ora_shared_ip_alerts where fingerprint = ${cluster.fingerprint} and report_id = ${reportId}`;
      console.error("[ora] shared ip report", err instanceof Error ? err.name : "error");
    }
  }
}

/** Records the signed-in live advisor only. Returns no IP data to the caller. */
export const recordAdvisorLogin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(() => ({}))
  .handler(async ({ context }) => {
    try {
      const { currentViewAs } = await import("@/lib/ora-view-as");
      if (await currentViewAs(context.userId)) return { ok: true as const };
      const sql = await getSql();
      await ensureIpSchema(sql);
      const advisor = await loadLiveAdvisor(sql, context.userId);
      if (!advisor) return { ok: true as const };
      const { readLoginObservation } = await import("@/lib/ora-client-ip.server");
      const observed = await readLoginObservation();
      const name = cleanText(advisor.name, 120) || "Advisor";
      const email = cleanText(advisor.email, 160);
      const ip = isPublicIp(observed.ip) || observed.ip === "127.0.0.1" ? observed.ip : normalizeIp(observed.ip);
      const sessionKey =
        observed.sessionKey ||
        `hour:${context.userId}:${ip}:${observed.device}:${new Date().toISOString().slice(0, 13)}`;
      await sql`
        insert into ora_advisor_login_ips (
          id, advisor_id, user_id, display_name, email, ip_address, user_agent, device_label, session_key
        ) values (
          ${rid("lip")}, ${advisor.id}, ${advisor.user_id}, ${name}, ${email},
          ${ip}, ${observed.userAgent}, ${observed.device}, ${sessionKey}
        )
        on conflict (session_key) do update set
          display_name = excluded.display_name,
          email = excluded.email,
          last_seen_at = now()
      `;
      if (isPublicIp(ip)) await syncSharedIpReports(sql);
    } catch (err) {
      console.error("[ora] advisor login ip", err instanceof Error ? err.name : "error");
    }
    return { ok: true as const };
  });

export const adminIpSecurity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "advisors");
    const sql = await getSql();
    await ensureIpSchema(sql);
    const events = await loadLoginEvents(sql);
    const seen = await sql<{
      advisor_id: string;
      logged_in_at: string;
      last_seen_at: string;
    }>`
      select advisor_id,
             to_char(max(logged_in_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as logged_in_at,
             to_char(max(last_seen_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_seen_at
      from ora_advisor_login_ips
      group by advisor_id
    `;
    const seenAt = new Map(seen.map((row) => [row.advisor_id, row.last_seen_at || row.logged_in_at]));
    const rows = latestAdvisorIps(events).map((row) => ({
      ...row,
      lastSeen: seenAt.get(row.advisorId) || row.lastLogin,
    }));
    return {
      rows,
      clusters: sharedIpClusters(events).map((cluster) => ({
        ip: cluster.ip,
        accountsDetected: cluster.accounts.length,
        firstDetected: cluster.firstDetected,
        lastDetected: cluster.lastDetected,
        accounts: cluster.accounts.map((account) => ({
          advisorId: account.advisorId,
          name: account.name,
          email: account.email,
          lastLogin: account.lastLogin,
          device: account.device,
        })),
      })),
    };
  });
