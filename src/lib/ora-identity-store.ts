import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  fileMatchesMime,
  identityFileError,
  identityFilesReady,
  identityMetaError,
  identityPastRetention,
  idNeedsBack,
  isIdMime,
  isIdSide,
  isIdType,
  type IdType,
} from "@/lib/ora-identity";
function rid(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

const TABLE_SQL = [
  `create table if not exists ora_identity_checks (
    id text primary key,
    application_id text not null,
    user_id text not null,
    legal_name text not null,
    country text not null,
    id_type text not null,
    status text not null default 'pending',
    rejection_reason text not null default '',
    consent_at timestamptz not null,
    reviewed_by text not null default '',
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists ora_identity_files (
    id text primary key,
    check_id text not null,
    side text not null,
    content_type text not null,
    byte_size integer not null,
    body_b64 text not null default '',
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `alter table ora_identity_files add column if not exists iv text not null default ''`,
  `create table if not exists ora_identity_chunks (
    id text primary key,
    check_id text not null,
    side text not null,
    idx integer not null,
    total integer not null,
    iv text not null,
    body_b64 text not null,
    created_at timestamptz not null default now()
  )`,
  `alter table ora_advisors add column if not exists public_hold text not null default ''`,
];

let ready = false;

export async function ensureIdentityTables() {
  if (ready) return;
  const sql = await getSql();
  for (const text of TABLE_SQL) {
    await sql.query(text);
  }
  ready = true;
}

type FileInput = { mime: string; base64: string };

function decodeFile(file: FileInput) {
  const error = identityFileError(file);
  if (error) throw new Error(error);
  const raw = file.base64.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  const bytes = Buffer.from(raw, "base64");
  if (!fileMatchesMime(bytes, file.mime)) throw new Error("The file contents do not match JPG, PNG, or PDF.");
  return { mime: file.mime, base64: raw, size: bytes.length };
}

export async function openApplicantIdentity(input: {
  userId: string;
  applicationId: string;
  legalName: string;
  country: string;
  idType: string;
  consent: boolean;
}) {
  const error = identityMetaError(input);
  if (error) throw new Error(error);
  if (!isIdType(input.idType)) throw new Error("Choose a government ID type.");
  await ensureIdentityTables();
  const sql = await getSql();
  const [app] = await sql<{ id: string }>`
    select id from ora_applications where id = ${input.applicationId} and user_id = ${input.userId} limit 1
  `;
  if (!app) throw new Error("Application not found.");
  const checkId = rid("idv");
  await sql`
    insert into ora_identity_checks (
      id, application_id, user_id, legal_name, country, id_type, status, consent_at
    ) values (
      ${checkId}, ${input.applicationId}, ${input.userId}, ${input.legalName.trim().slice(0, 80)},
      ${input.country.trim().slice(0, 80)}, ${input.idType}, 'pending', now()
    )
  `;
  return { id: checkId, status: "pending" as const };
}

export async function identityStatusForApplication(applicationId: string) {
  await ensureIdentityTables();
  const sql = await getSql();
  const [row] = await sql<{ status: string }>`
    select status from ora_identity_checks
    where application_id = ${applicationId}
    order by created_at desc
    limit 1
  `;
  return row?.status ?? null;
}

export async function identityStatusForUser(userId: string) {
  await ensureIdentityTables();
  const sql = await getSql();
  const [row] = await sql<{ status: string }>`
    select status from ora_identity_checks
    where user_id = ${userId}
    order by created_at desc
    limit 1
  `;
  return row?.status ?? null;
}

export type IdentitySummary = {
  id: string;
  applicationId: string;
  legalName: string;
  country: string;
  idType: IdType | string;
  status: string;
  rejectionReason: string;
  files: { id: string; side: string; contentType: string; byteSize: number }[];
};

export async function identitySummaries(applicationIds: string[]): Promise<IdentitySummary[]> {
  if (!applicationIds.length) return [];
  await ensureIdentityTables();
  await purgeExpiredIdentityBodies();
  const sql = await getSql();
  const checks = await sql.query<{
    id: string;
    application_id: string;
    legal_name: string;
    country: string;
    id_type: string;
    status: string;
    rejection_reason: string;
    created_at: string;
  }>(
    `select id, application_id, legal_name, country, id_type, status, rejection_reason, created_at::text as created_at
     from ora_identity_checks
     where application_id = any($1::text[])
     order by created_at desc`,
    [applicationIds],
  );
  const latest = new Map<string, (typeof checks)[number]>();
  for (const row of checks) {
    if (!latest.has(row.application_id)) latest.set(row.application_id, row);
  }
  const ids = [...latest.values()].map((row) => row.id);
  const files = ids.length
    ? await sql.query<{ id: string; check_id: string; side: string; content_type: string; byte_size: number; deleted_at: string | null }>(
        `select id, check_id, side, content_type, byte_size, deleted_at::text as deleted_at
         from ora_identity_files
         where check_id = any($1::text[])`,
        [ids],
      )
    : [];
  return [...latest.values()].map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    legalName: row.legal_name,
    country: row.country,
    idType: row.id_type,
    status: row.status,
    rejectionReason: row.rejection_reason,
    files: files
      .filter((file) => file.check_id === row.id && !file.deleted_at)
      .map((file) => ({
        id: file.id,
        side: file.side,
        contentType: file.content_type,
        byteSize: Number(file.byte_size) || 0,
      })),
  }));
}

async function purgeExpiredIdentityBodies() {
  const sql = await getSql();
  const rows = await sql<{ id: string; status: string; created_at: string }>`
    select id, status, created_at::text as created_at from ora_identity_checks
  `;
  const stale = rows.filter((row) => identityPastRetention(row.created_at, row.status)).map((row) => row.id);
  if (!stale.length) return;
  await sql.query(
    `update ora_identity_files
     set body_b64 = '', deleted_at = coalesce(deleted_at, now())
     where check_id = any($1::text[]) and deleted_at is null`,
    [stale],
  );
}

export async function promoteIdentityHold(userId: string) {
  await ensureIdentityTables();
  const sql = await getSql();
  await sql`
    update ora_advisors
    set status = 'live', public_hold = ''
    where user_id = ${userId} and status = 'paused' and public_hold = 'identity'
  `;
}

async function notifyIdentity(userId: string, status: string, reason: string) {
  const title = status === "verified" ? "Identity verified" : "Identity not accepted";
  const body =
    status === "verified"
      ? "An admin verified your government ID. Your profile can go live only after the application is approved too."
      : `An admin did not accept the government ID.${reason ? ` ${reason}` : ""}`;
  try {
    const sql = await getSql();
    await sql`
      insert into ora_customer_alerts (id, user_id, advisor_id, kind, title, body, href)
      values (${rid("alrt")}, ${userId}, '', 'identity', ${title}, ${body.slice(0, 400)}, '/advisor/applied')
    `;
  } catch (err) {
    console.error("[ora] identity notice");
  }
}

export async function reviewIdentity(input: {
  actorId: string;
  checkId: string;
  decision: "verified" | "rejected";
  reason: string;
}) {
  await ensureIdentityTables();
  const sql = await getSql();
  const [row] = await sql<{ id: string; user_id: string; status: string; id_type: string }>`
    select id, user_id, status, id_type from ora_identity_checks where id = ${input.checkId} limit 1
  `;
  if (!row) throw new Error("Identity check not found.");
  if (input.decision === "rejected" && !input.reason.trim()) throw new Error("Enter a rejection reason.");
  if (input.decision === "verified") {
    const files = await sql<{ side: string }>`
      select side from ora_identity_files
      where check_id = ${row.id} and deleted_at is null and body_b64 <> ''
    `;
    if (!identityFilesReady(files.map((file) => file.side), row.id_type)) {
      throw new Error("The ID front, back when required, and a selfie must be on file before verification.");
    }
  }
  await sql`
    update ora_identity_checks
    set status = ${input.decision},
        rejection_reason = ${input.decision === "rejected" ? input.reason.trim().slice(0, 400) : ""},
        reviewed_by = ${input.actorId},
        reviewed_at = now()
    where id = ${row.id}
  `;
  if (input.decision === "verified") await promoteIdentityHold(row.user_id);
  if (input.decision === "rejected" && row.status === "verified") {
    await sql`
      update ora_advisors
      set status = 'paused', public_hold = 'identity', online = false, busy = false
      where user_id = ${row.user_id} and status = 'live'
    `;
  }
  await notifyIdentity(row.user_id, input.decision, input.reason.trim());
  return { ok: true as const, status: input.decision };
}

export async function eraseIdentityForUser(userId: string) {
  try {
    await ensureIdentityTables();
    const sql = await getSql();
    const checks = await sql<{ id: string }>`select id from ora_identity_checks where user_id = ${userId}`;
    const ids = checks.map((row) => row.id);
    if (!ids.length) return;
    await sql.query(
      `update ora_identity_files
       set body_b64 = '', iv = '', deleted_at = coalesce(deleted_at, now())
       where check_id = any($1::text[])`,
      [ids],
    );
    await sql.query(`delete from ora_identity_chunks where check_id = any($1::text[])`, [ids]);
    await sql`
      update ora_identity_checks
      set legal_name = '', country = '', rejection_reason = ''
      where user_id = ${userId}
    `;
  } catch (err) {
    console.error("[ora] identity erase");
  }
}

export const adminIdentityFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { fileId?: string }) => ({ fileId: String(input.fileId || "").slice(0, 80) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/ora");
    await requireAdmin(context.userId, "advisors");
    await ensureIdentityTables();
    const sql = await getSql();
    const [file] = await sql<{ content_type: string; body_b64: string; iv: string; deleted_at: string | null }>`
      select content_type, body_b64, coalesce(iv, '') as iv, deleted_at::text as deleted_at
      from ora_identity_files where id = ${data.fileId} limit 1
    `;
    if (!file || file.deleted_at || !file.body_b64) throw new Error("That document is no longer stored.");
    if (!file.iv) return { mime: file.content_type, base64: file.body_b64 };
    const { decryptIdentityBytes } = await import("@/lib/ora-identity-crypto");
    return { mime: file.content_type, base64: decryptIdentityBytes(file.body_b64, file.iv).toString("base64") };
  });

export const adminReviewIdentity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { checkId?: string; decision?: string; reason?: string }) => ({
    checkId: String(input.checkId || "").slice(0, 80),
    decision: input.decision === "verified" ? ("verified" as const) : ("rejected" as const),
    reason: String(input.reason || "").trim().slice(0, 400),
  }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/ora");
    await requireAdmin(context.userId, "advisors");
    return reviewIdentity({ actorId: context.userId, checkId: data.checkId, decision: data.decision, reason: data.reason });
  });

export const adminDeleteIdentityFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { fileId?: string }) => ({ fileId: String(input.fileId || "").slice(0, 80) }))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/ora");
    await requireAdmin(context.userId, "advisors");
    await ensureIdentityTables();
    const sql = await getSql();
    await sql`
      update ora_identity_files
      set body_b64 = '', iv = '', deleted_at = now()
      where id = ${data.fileId}
    `;
    return { ok: true as const };
  });

export const applicantIdentityState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureIdentityTables();
    const sql = await getSql();
    const [row] = await sql<{ id: string; status: string; id_type: string; rejection_reason: string }>`
      select id, status, id_type, rejection_reason
      from ora_identity_checks
      where user_id = ${context.userId}
      order by created_at desc
      limit 1
    `;
    if (!row) return null;
    const files = await sql<{ side: string }>`
      select side from ora_identity_files
      where check_id = ${row.id} and deleted_at is null and body_b64 <> ''
    `;
    return {
      id: row.id,
      status: row.status,
      idType: row.id_type,
      rejectionReason: row.rejection_reason,
      complete: identityFilesReady(files.map((file) => file.side), row.id_type),
    };
  });

export const submitApplicantIdentity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    legalName?: string;
    country?: string;
    idType?: string;
    consent?: boolean;
    front?: { mime?: string; base64?: string } | null;
    back?: { mime?: string; base64?: string } | null;
  }) => parseIdentityInput(input))
  .handler(async ({ context, data }) => {
    const error = identityMetaError(data);
    if (error) throw new Error(error);
    await ensureIdentityTables();
    const sql = await getSql();
    const [app] = await sql<{ id: string }>`
      select id from ora_applications
      where user_id = ${context.userId} and status in ('pending', 'approved')
      order by created_at desc
      limit 1
    `;
    if (!app) throw new Error("Submit an application first.");
    const current = await identityStatusForApplication(app.id);
    if (current === "pending" || current === "verified") throw new Error("Identity documents are already on file.");
    return openApplicantIdentity({
      userId: context.userId,
      applicationId: app.id,
      legalName: data.legalName,
      country: data.country,
      idType: data.idType,
      consent: data.consent,
    });
  });

export const uploadIdentityChunk = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { checkId?: string; side?: string; mime?: string; index?: number; total?: number; chunk?: string }) => ({
    checkId: String(input.checkId || "").slice(0, 80),
    side: String(input.side || ""),
    mime: String(input.mime || ""),
    index: Math.max(0, Math.floor(Number(input.index) || 0)),
    total: Math.max(0, Math.floor(Number(input.total) || 0)),
    chunk: String(input.chunk || "").replace(/\s/g, "").slice(0, 500_000),
  }))
  .handler(async ({ context, data }) => {
    if (!isIdSide(data.side) || !isIdMime(data.mime)) throw new Error("That identity file is not accepted.");
    if (!data.chunk || data.total < 1 || data.total > 40 || data.index >= data.total) throw new Error("That identity file could not be stored.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.chunk)) throw new Error("That identity file could not be stored.");
    await ensureIdentityTables();
    const sql = await getSql();
    const [check] = await sql<{ id: string; status: string; id_type: string }>`
      select id, status, id_type from ora_identity_checks
      where id = ${data.checkId} and user_id = ${context.userId}
      limit 1
    `;
    if (!check || check.status !== "pending") throw new Error("Identity documents are not open for upload.");
    if (data.side === "back" && !idNeedsBack(check.id_type)) throw new Error("This ID does not use a back image.");
    const { encryptIdentityText, decryptIdentityText, encryptIdentityBytes } = await import("@/lib/ora-identity-crypto");
    const sealed = encryptIdentityText(data.chunk);
    await sql`delete from ora_identity_chunks where check_id = ${check.id} and side = ${data.side} and idx = ${data.index}`;
    await sql`
      insert into ora_identity_chunks (id, check_id, side, idx, total, iv, body_b64)
      values (${rid("idc")}, ${check.id}, ${data.side}, ${data.index}, ${data.total}, ${sealed.iv}, ${sealed.body})
    `;
    const rows = await sql<{ idx: number; iv: string; body_b64: string }>`
      select idx, iv, body_b64 from ora_identity_chunks
      where check_id = ${check.id} and side = ${data.side}
      order by idx
    `;
    if (rows.length < data.total) return { ok: true as const, stored: false };
    const byIndex = new Map(rows.map((row) => [Number(row.idx), row]));
    let joined = "";
    for (let i = 0; i < data.total; i += 1) {
      const part = byIndex.get(i);
      if (!part) return { ok: true as const, stored: false };
      joined += decryptIdentityText(part.body_b64, part.iv);
    }
    const decoded = decodeFile({ mime: data.mime, base64: joined });
    const stored = encryptIdentityBytes(Buffer.from(decoded.base64, "base64"));
    await sql`
      update ora_identity_files
      set body_b64 = '', iv = '', deleted_at = now()
      where check_id = ${check.id} and side = ${data.side} and deleted_at is null
    `;
    await sql`
      insert into ora_identity_files (id, check_id, side, content_type, byte_size, body_b64, iv)
      values (${rid("idf")}, ${check.id}, ${data.side}, ${decoded.mime}, ${decoded.size}, ${stored.body}, ${stored.iv})
    `;
    await sql`delete from ora_identity_chunks where check_id = ${check.id} and side = ${data.side}`;
    return { ok: true as const, stored: true };
  });

export function parseIdentityInput(input: {
  legalName?: string;
  country?: string;
  idType?: string;
  consent?: boolean;
  front?: { mime?: string; base64?: string } | null;
  back?: { mime?: string; base64?: string } | null;
} | null | undefined) {
  return {
    legalName: String(input?.legalName || "").trim().slice(0, 80),
    country: String(input?.country || "").trim().slice(0, 80),
    idType: String(input?.idType || ""),
    consent: Boolean(input?.consent),
  };
}
