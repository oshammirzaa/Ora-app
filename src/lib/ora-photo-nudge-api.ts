import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { visibleAdvisorPhoto } from "@/lib/ora-advisor-desk-stats";
import {
  PHOTO_NUDGE_HREF,
  customerPhotoNudgeEligible,
  hasCustomerPhoto,
  type PhotoNudgeState,
} from "@/lib/ora-photo-nudge";

let schemaReady = false;

export async function ensurePhotoNudgeSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  try {
    await sql.query("alter table ora_profiles add column if not exists photo_nudge_started_at timestamptz");
    await sql.query("alter table ora_profiles add column if not exists photo_nudge_dismissed_at timestamptz");
    schemaReady = true;
  } catch (err) {
    console.error("[ora] photo nudge schema", err);
  }
}

async function loadPhotoNudge(userId: string): Promise<PhotoNudgeState> {
  try {
    const { ensureAccount } = await import("@/lib/ora");
    await ensureAccount(userId, "");
  } catch (err) {
    console.error("[ora] photo nudge account", err);
  }
  const sql = await getSql();
  const [auth] = await sql<{ image: string | null }>`
    select image from "user" where id = ${userId}
  `.catch(() => []);
  const hasPhoto = hasCustomerPhoto(auth?.image);
  const [profile] = await sql<{ role: string }>`
    select role from ora_profiles where user_id = ${userId}
  `.catch(() => []);
  const [admin] = await sql<{ user_id: string }>`
    select user_id from ora_admins where user_id = ${userId}
  `.catch(() => []);
  const [advisor] = await sql<{ id: string }>`
    select id from ora_advisors where user_id = ${userId} and status = 'live' limit 1
  `.catch(() => []);
  const eligible = customerPhotoNudgeEligible({
    role: profile?.role,
    isAdmin: Boolean(admin?.user_id),
    isAdvisor: Boolean(advisor?.id),
  });
  return {
    show: eligible && !hasPhoto,
    waitMs: 0,
    hasPhoto,
    eligible,
    href: PHOTO_NUDGE_HREF,
  };
}

export const getPhotoNudge = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const at =
      input && typeof input === "object" && "at" in input ? Number((input as { at?: unknown }).at) : 0;
    return { at: Number.isFinite(at) ? at : 0 };
  })
  .handler(async ({ context }) => loadPhotoNudge(context.userId));

export const dismissPhotoNudge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensurePhotoNudgeSchema();
    const sql = await getSql();
    await sql`
      update ora_profiles
      set photo_nudge_dismissed_at = coalesce(photo_nudge_dismissed_at, now())
      where user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const updateCustomerPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { image: string }) => ({ image: String(input.image || "") }))
  .handler(async ({ context, data }) => {
    const photo = visibleAdvisorPhoto(data.image);
    if (!photo) throw new Error("Choose a photo (jpg or png).");
    if (photo.length > 100_000) throw new Error("Photo is too large. Try a simpler image.");
    const sql = await getSql();
    await sql`update "user" set image = ${photo} where id = ${context.userId}`;
    await ensurePhotoNudgeSchema();
    await sql`
      update ora_profiles
      set photo_nudge_dismissed_at = coalesce(photo_nudge_dismissed_at, now())
      where user_id = ${context.userId}
    `.catch(() => {});
    return { ok: true as const, image: photo };
  });
