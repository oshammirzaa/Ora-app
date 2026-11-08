/** Admin profile edits for an existing advisor row. Does not touch money columns. */

export const ADVISOR_PROFILE_UPDATE_SQL = `
update ora_advisors
   set name = $1,
       bio = $2,
       specialties = $3,
       rate_coins = $4,
       status = $5,
       trusted = $6,
       years = $7,
       languages = $8,
       photo_url = $9,
       online = $10,
       busy = case when $11 = 1 then false else busy end
 where id = $12
returning id
`;

/** Columns this update is allowed to write. Earnings and payouts are not in this list. */
export const ADVISOR_PROFILE_WRITE_COLUMNS = [
  "name",
  "bio",
  "specialties",
  "rate_coins",
  "status",
  "trusted",
  "years",
  "languages",
  "photo_url",
  "online",
  "busy",
] as const;

export const ADVISOR_PROFILE_PROTECTED_COLUMNS = [
  "id",
  "user_id",
  "slug",
  "payout_coins",
  "pending_coins",
  "message_earn_cents",
  "rating",
  "reviews",
] as const;

export type AdvisorApproval = "approved" | "suspended" | "pending";
export type AdvisorFloorStatus = "live" | "paused" | "suspended" | "pending";

export type AdvisorProfileEditInput = {
  id?: unknown;
  name?: unknown;
  bio?: unknown;
  specialties?: unknown;
  years?: unknown;
  languages?: unknown;
  rateCoins?: unknown;
  online?: unknown;
  visible?: unknown;
  featured?: unknown;
  approval?: unknown;
  photoUrl?: unknown;
};

export type ValidatedAdvisorProfile = {
  id: string;
  name: string;
  bio: string;
  specialties: string;
  years: number;
  languages: string;
  rateCoins: number;
  online: boolean;
  featured: boolean;
  status: AdvisorFloorStatus;
  photoUrl: string;
};

type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

function boundedText(value: unknown, max: number, label: string, required = false) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or less.`);
  return text;
}

function requiredFlag(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new Error(`${label} is required.`);
  return value;
}

function editRate(value: unknown) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 8 || n > 80) {
    throw new Error("Rate must be between 8 and 80 coins per minute.");
  }
  return n;
}

function editPhoto(value: unknown) {
  const photo = String(value ?? "").trim();
  if (!photo) return "";
  if (photo.length > 400_000) throw new Error("Photo is too large.");
  if (photo.startsWith("data:image/") || photo.startsWith("/") || /^https?:\/\//i.test(photo)) return photo;
  throw new Error("Photo must be an uploaded image or an http(s) URL.");
}

export function advisorEditDefaults(status: string): { approval: AdvisorApproval; visible: boolean } {
  const current = String(status || "").trim().toLowerCase();
  if (current === "suspended") return { approval: "suspended", visible: false };
  if (current === "pending") return { approval: "pending", visible: false };
  if (current === "live") return { approval: "approved", visible: true };
  return { approval: "approved", visible: false };
}

/**
 * Pending and suspended lock the visibility control, so a re-approval still
 * arrives with visible=false. That leftover flag must not pause the desk.
 * An advisor who is already live or paused keeps the visibility the admin chose.
 */
export function floorStatusAfterApprovalEdit(
  previousStatus: string,
  next: { status: AdvisorFloorStatus; online: boolean },
): { status: AdvisorFloorStatus; online: boolean } {
  const previous = String(previousStatus || "").trim().toLowerCase();
  const locked = previous === "pending" || previous === "suspended";
  if (locked && next.status === "paused") return { status: "live", online: false };
  return { status: next.status, online: next.online };
}

/** Application row to update when the floor status itself changes. Paused and suspended leave it alone. */
export function applicationStatusForFloor(status: AdvisorFloorStatus): "approved" | "pending" | null {
  if (status === "live") return "approved";
  if (status === "pending") return "pending";
  return null;
}

export function validateAdvisorProfileEdit(input: AdvisorProfileEditInput): ValidatedAdvisorProfile {
  const id = String(input.id ?? "").trim();
  if (!id || id.length > 64) throw new Error("Advisor is required.");
  const name = boundedText(input.name, 80, "Display name", true);
  const bio = boundedText(input.bio, 1200, "Bio");
  const specialties = boundedText(input.specialties, 120, "Specialties");
  const languages = boundedText(input.languages, 80, "Languages");
  if (!languages) throw new Error("Languages are required.");
  const years = Number(input.years);
  if (!Number.isFinite(years) || Math.floor(years) !== years || years < 0 || years > 60) {
    throw new Error("Years of experience must be a whole number from 0 to 60.");
  }
  const approval = String(input.approval ?? "").trim().toLowerCase();
  if (approval !== "approved" && approval !== "suspended" && approval !== "pending") {
    throw new Error("Choose a valid approval status.");
  }
  const visible = requiredFlag(input.visible, "Profile visibility");
  const featured = requiredFlag(input.featured, "Featured status");
  const wantsOnline = requiredFlag(input.online, "Online status");
  const status: AdvisorFloorStatus =
    approval === "suspended" ? "suspended" : approval === "pending" ? "pending" : visible ? "live" : "paused";
  return {
    id,
    name,
    bio,
    specialties,
    years,
    languages,
    rateCoins: editRate(input.rateCoins),
    featured,
    status,
    online: status === "live" && wantsOnline,
    photoUrl: editPhoto(input.photoUrl),
  };
}

/** Update one existing advisor. Returns null when the id does not match a row. */
export async function writeAdvisorProfile(sql: Queryable, data: ValidatedAdvisorProfile) {
  const clearBusy = data.status !== "live" || !data.online;
  const rows = await sql.query<{ id: string }>(ADVISOR_PROFILE_UPDATE_SQL, [
    data.name,
    data.bio,
    data.specialties,
    data.rateCoins,
    data.status,
    data.featured,
    data.years,
    data.languages,
    data.photoUrl,
    data.online,
    clearBusy ? 1 : 0,
    data.id,
  ]);
  return rows[0] ?? null;
}

/**
 * Keep the application tab and account role aligned with a real status change.
 * Bio edits and deliberate pauses do not rewrite an already-approved application.
 */
export async function syncAdvisorApprovalRecord(
  sql: Queryable,
  input: { userId: string; previousStatus: string; status: AdvisorFloorStatus; decidedBy: string },
) {
  const userId = String(input.userId || "").trim();
  if (!userId) return;
  const previous = String(input.previousStatus || "").trim().toLowerCase();
  if (previous === input.status) return;
  if (input.status === "live") {
    await sql.query(
      `update ora_profiles set role = 'advisor' where user_id = $1 and role in ('client', 'customer')`,
      [userId],
    );
  }
  const decision = applicationStatusForFloor(input.status);
  if (!decision) return;
  const rows = await sql.query<{ id: string }>(
    `select id from ora_applications where user_id = $1 order by created_at desc limit 1`,
    [userId],
  );
  const appId = rows[0]?.id;
  if (!appId) return;
  const decidedBy = String(input.decidedBy || "").slice(0, 128);
  try {
    await sql.query(
      `update ora_applications
          set status = $1, decided_at = now(), decided_by = $2
        where id = $3 and status is distinct from $1`,
      [decision, decidedBy, appId],
    );
  } catch {
    await sql.query(
      `update ora_applications set status = $1 where id = $2 and status is distinct from $1`,
      [decision, appId],
    );
  }
}
