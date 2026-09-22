import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { visibleAdvisorPhoto } from "@/lib/ora-advisor-desk-stats";
import {
  PHOTO_NUDGE_HREF,
  hasCustomerPhoto,
  photoNudgeWaitMs,
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
  await ensurePhotoNudgeSchema();
  const { ensureAccount } = await import("@/lib/ora");
  await ensureAccount(userId, "");
  const sql = await getSql();
  const [auth] = await sql<{ image: string | null }>`
    select image from "user" where id = ${userId}
  `.catch(() => []);
  const hasPhoto = hasCustomerPhoto(auth?.image);
  const [row] = await sql<{ started_at: string | null; dismissed_at: string | null }>`
    select photo_nudge_started_at::text as started_at, photo_nudge_dismissed_at::text as dismissed_at
    from ora_profiles where user_id = ${userId}
  `.catch(() => []);
  const dismissed = Boolean(row?.dismissed_at);

  if (hasPhoto) {
    if (!dismissed) {
      await sql`
        update ora_profiles
        set photo_nudge_dismissed_at = coalesce(photo_nudge_dismissed_at, now())
        where user_id = ${userId}
      `.catch(() => {});
    }
    return { show: false, waitMs: 0, hasPhoto: true, href: PHOTO_NUDGE_HREF };
  }
  if (dismissed) return { show: false, waitMs: 0, hasPhoto: false, href: PHOTO_NUDGE_HREF };

  let startedAt = row?.started_at || "";
  if (!startedAt) {
    const [started] = await sql<{ started_at: string }>`
      update ora_profiles
      set photo_nudge_started_at = coalesce(photo_nudge_started_at, now())
      where user_id = ${userId}
      returning photo_nudge_started_at::text as started_at
    `.catch(() => []);
    startedAt = started?.started_at || new Date().toISOString();
  }
  const waitMs = photoNudgeWaitMs({ startedAt });
  return { show: waitMs === 0, waitMs, hasPhoto: false, href: PHOTO_NUDGE_HREF };
}

export const getPhotoNudge = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
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
