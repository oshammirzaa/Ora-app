import { normalizeGender } from "./ora-advisor-desk-stats.ts";

/** Lifetime net spend thresholds in USD cents. Inclusive lower bounds. */
export const LOYALTY_SILVER_CENTS = 5_000; // $50
export const LOYALTY_GOLD_CENTS = 20_000; // $200
export const LOYALTY_DIAMOND_CENTS = 50_000; // $500
export const LOYALTY_ROYAL_CENTS = 200_000; // $2,000

export type LoyaltyTier = "none" | "silver" | "gold" | "diamond" | "king" | "queen" | "crown";

export type LoyaltyRecord = {
  tier: LoyaltyTier;
  spendCents: number;
  gender: string;
};

export const LOYALTY_COPY: Record<LoyaltyTier, { title: string; subtitle: string }> = {
  none: { title: "No badge", subtitle: "Less than $50" },
  silver: { title: "Silver", subtitle: "A Valued Client" },
  gold: { title: "Gold", subtitle: "A Loyal Client" },
  diamond: { title: "Diamond", subtitle: "A VIP Client" },
  king: { title: "King", subtitle: "Top Client" },
  queen: { title: "Queen", subtitle: "Top Client" },
  crown: { title: "Crown", subtitle: "Top Client" },
};

const NONE: LoyaltyRecord = { tier: "none", spendCents: 0, gender: "unspecified" };

let schemaReady = 0;
const SCHEMA_VERSION = 2;

export async function ensureLoyaltySchema() {
  if (schemaReady >= SCHEMA_VERSION) return;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    await sql.query("alter table ora_profiles add column if not exists gender text not null default ''");
    await sql.query("alter table ora_profiles add column if not exists date_of_birth text not null default ''");
  } catch (err) {
    console.error("[ora] loyalty schema", err);
  }
  schemaReady = SCHEMA_VERSION;
}

export function loyaltySpendCents(
  rows: Array<{ amount_cents?: unknown; amountCents?: unknown; status?: unknown; currency?: unknown }>,
): number {
  let sum = 0;
  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    if (status !== "succeeded") continue;
    const currency = String(row.currency || "usd").toLowerCase();
    if (currency && currency !== "usd") continue;
    const cents = Number(row.amount_cents ?? row.amountCents);
    if (!Number.isFinite(cents) || cents <= 0) continue;
    sum += Math.floor(cents);
  }
  return sum;
}

export function loyaltyTierFromCents(cents: unknown, gender?: unknown): LoyaltyTier {
  const n = Math.max(0, Math.floor(Number(cents) || 0));
  if (n < LOYALTY_SILVER_CENTS) return "none";
  if (n < LOYALTY_GOLD_CENTS) return "silver";
  if (n < LOYALTY_DIAMOND_CENTS) return "gold";
  if (n < LOYALTY_ROYAL_CENTS) return "diamond";
  const g = normalizeGender(gender);
  if (g === "male") return "king";
  if (g === "female") return "queen";
  return "crown";
}

export function loyaltyLabel(tier: LoyaltyTier | string | null | undefined) {
  const key = isLoyaltyTier(tier) ? tier : "none";
  const copy = LOYALTY_COPY[key];
  return key === "none" ? copy.title : `${copy.title} · ${copy.subtitle}`;
}

export function isLoyaltyTier(value: unknown): value is LoyaltyTier {
  return (
    value === "none" ||
    value === "silver" ||
    value === "gold" ||
    value === "diamond" ||
    value === "king" ||
    value === "queen" ||
    value === "crown"
  );
}

export function loyaltyTierPublic(record: LoyaltyRecord | undefined | null): LoyaltyTier {
  return record?.tier && record.tier !== "none" ? record.tier : "none";
}

export async function loadLoyaltyByUserIds(userIds: string[]): Promise<Map<string, LoyaltyRecord>> {
  const ids = [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))];
  const out = new Map<string, LoyaltyRecord>();
  for (const id of ids) out.set(id, { ...NONE });
  if (!ids.length) return out;
  await ensureLoyaltySchema();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const spendRows = await sql
    .query<{ user_id: string; spend_cents: number }>(
      `select user_id, coalesce(sum(amount_cents), 0)::int as spend_cents
       from ora_payments
       where status = 'succeeded'
         and lower(coalesce(currency, 'usd')) = 'usd'
         and user_id in (${placeholders})
       group by user_id`,
      ids,
    )
    .catch(() => []);
  const genderRows = await sql
    .query<{ user_id: string; gender: string }>(
      `select user_id, coalesce(gender, '') as gender
       from ora_profiles
       where user_id in (${placeholders})`,
      ids,
    )
    .catch(() => []);
  const genderMap = new Map(genderRows.map((row) => [row.user_id, String(row.gender || "")]));
  const spendMap = new Map(spendRows.map((row) => [row.user_id, Number(row.spend_cents) || 0]));
  for (const id of ids) {
    const spendCents = Math.max(0, spendMap.get(id) || 0);
    const gender = genderMap.get(id) || "";
    out.set(id, {
      spendCents,
      gender,
      tier: loyaltyTierFromCents(spendCents, gender),
    });
  }
  return out;
}

export async function loadLoyaltyForUser(userId: string): Promise<LoyaltyRecord> {
  const id = String(userId || "").trim();
  if (!id) return { ...NONE };
  const map = await loadLoyaltyByUserIds([id]);
  return map.get(id) ?? { ...NONE };
}
