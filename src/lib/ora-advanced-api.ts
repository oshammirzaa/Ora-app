import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, withSqlTransaction, type Sql } from "@/lib/db";
import { auditLog, authName, ensureAccount, requireAdmin, rid } from "@/lib/ora";
import { advancedDisabled, advancedFlags, flagOn } from "@/lib/ora-feature-flags";
import {
  ONLINE_ALERT_COPY,
  alertAllowed,
  bookingOccupies,
  buildSlots,
  canCustomerCancel,
  civilWeekday,
  giftPurchaseLocked,
  giftRedeemAllowed,
  isSlotDuration,
  nextStreak,
  parseDayWindows,
  parseSmartReplies,
  performanceScore,
  rangeStartMs,
  referralEligible,
  rewardCoinsForDay,
  rewardIpBlocked,
  wallTimeToUtcMs,
  type DayWindow,
  type PerformanceInput,
} from "@/lib/ora-advanced-rules";
import { deviceLabel } from "@/lib/ora-ip-security";

const REWARD_FALLBACK = { enabled: true, rewards: [1, 1, 2, 2, 3, 3, 5], cooldownHours: 24, maxAccountsPerIp: 2 };
const REFERRAL_FALLBACK = { enabled: true, referrerCoins: 10, referredCoins: 10 };
const GIFT_FALLBACK = { purchasesEnabled: false, denominations: [10, 20, 30, 50] };
const ALERT_FALLBACK = { cooldownHours: 6 };
const BOOKING_FALLBACK = { enabled: true, cancelHours: 2, leadMinutes: 15, reminders: [60, 15] };

type RewardSettings = typeof REWARD_FALLBACK;
type ReferralSettings = typeof REFERRAL_FALLBACK;
type GiftSettings = typeof GIFT_FALLBACK;

function clip(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function iso(value: unknown) {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

function localDate(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

async function sha(value: string) {
  const { createHash } = await import("node:crypto");
  const salt = process.env["BETTER_AUTH_SECRET"] || "ora-preview";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

async function observation() {
  try {
    const { readLoginObservation } = await import("./ora-client-ip.server");
    return await readLoginObservation();
  } catch {
    return { ip: "", userAgent: "", device: "Unknown device", sessionKey: "" };
  }
}

async function readJson<T extends Record<string, unknown>>(sql: Sql, key: string, fallback: T): Promise<T> {
  const rows = await sql<{ value_json: string }>`select value_json from ora_advanced_settings where key = ${key}`.catch(() => []);
  if (!rows[0]?.value_json) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(rows[0].value_json) as Partial<T>) };
  } catch {
    return fallback;
  }
}

async function writeJson(sql: Sql, key: string, value: unknown) {
  const json = JSON.stringify(value);
  await sql`
    insert into ora_advanced_settings (key, value_json, updated_at)
    values (${key}, ${json}, now())
    on conflict (key) do update set value_json = excluded.value_json, updated_at = now()
  `;
}

async function advisorFor(userId: string, mode: "read" | "write" = "read") {
  const { assertOwnerViewIsReadOnly, deskUserId } = await import("./ora-view-as");
  if (mode === "write") await assertOwnerViewIsReadOnly(userId);
  const { requireApprovedAdvisor } = await import("./ora-advisor");
  return requireApprovedAdvisor(await deskUserId(userId));
}

async function advisorByRef(sql: Sql, ref: string) {
  const key = clip(ref, 80);
  const [row] = await sql<{ id: string; name: string; slug: string; status: string }>`
    select id, name, slug, status from ora_advisors
    where (id = ${key} or slug = ${key}) and status = 'live'
  `;
  return row ?? null;
}

async function emailOf(sql: Sql, userId: string) {
  const [user] = await sql<{ email: string }>`select email from "user" where id = ${userId}`.catch(() => []);
  if (user?.email) return String(user.email);
  const [profile] = await sql<{ email: string }>`select email from ora_profiles where user_id = ${userId}`.catch(() => []);
  return String(profile?.email || "");
}

async function creditPromo(sql: Sql, userId: string, coins: number, kind: string, note: string, refId: string) {
  const amount = Math.max(0, Math.floor(coins));
  if (!amount) return;
  const [wallet] = await sql<{ user_id: string }>`select user_id from ora_wallets where user_id = ${userId}`;
  if (!wallet) throw new Error("Wallet is not ready.");
  await sql`update ora_wallets set coins = coins + ${amount}, promo_coins = promo_coins + ${amount} where user_id = ${userId}`;
  await sql`
    insert into ora_ledger (id, user_id, kind, amount_coins, seconds, note, ref_id)
    values (${rid("led")}, ${userId}, ${kind}, ${amount}, 0, ${note}, ${refId})
  `;
}

async function debitPromo(sql: Sql, userId: string, coins: number, kind: string, note: string, refId: string) {
  const amount = Math.max(0, Math.floor(coins));
  if (!amount) return 0;
  const [wallet] = await sql<{ coins: number; promo_coins: number }>`
    select coins, promo_coins from ora_wallets where user_id = ${userId} for update
  `;
  if (!wallet) return 0;
  const take = Math.min(amount, Math.max(0, Number(wallet.coins) || 0), Math.max(0, Number(wallet.promo_coins) || 0));
  if (take <= 0) return 0;
  await sql`
    update ora_wallets
    set coins = coins - ${take}, promo_coins = greatest(0, promo_coins - ${take})
    where user_id = ${userId}
  `;
  await sql`
    insert into ora_ledger (id, user_id, kind, amount_coins, seconds, note, ref_id)
    values (${rid("led")}, ${userId}, ${kind}, ${-take}, 0, ${note}, ${refId})
  `;
  return take;
}

type Availability = { timezone: string; days: Record<string, DayWindow[]> };

function parseAvailability(raw: string, timezone: string): Availability {
  let parsed: { timezone?: string; days?: Record<string, unknown> } = {};
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    parsed = {};
  }
  const days: Record<string, DayWindow[]> = {};
  for (const key of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) days[key] = parseDayWindows(parsed.days?.[key]);
  return { timezone: clip(parsed.timezone || timezone || "UTC", 80) || "UTC", days };
}

async function loadAvailability(sql: Sql, advisorId: string): Promise<Availability | null> {
  const [row] = await sql<{ timezone: string; windows_json: string }>`
    select timezone, windows_json from ora_booking_availability where advisor_id = ${advisorId}
  `.catch(() => []);
  if (!row) return null;
  return parseAvailability(row.windows_json, row.timezone);
}

function windowsFor(avail: Availability, date: string) {
  return avail.days[civilWeekday(date, avail.timezone)] || [];
}

async function busyRanges(sql: Sql, advisorId: string, fromIso: string, toIso: string) {
  const rows = await sql<{ start_at: string; end_at: string; status: string }>`
    select start_at, end_at, status from ora_scheduled_readings
    where advisor_id = ${advisorId}
      and start_at < ${toIso}::timestamptz
      and end_at > ${fromIso}::timestamptz
  `;
  return rows
    .filter((row) => bookingOccupies(row.status))
    .map((row) => ({ startMs: new Date(row.start_at).getTime(), endMs: new Date(row.end_at).getTime() }))
    .filter((row) => Number.isFinite(row.startMs) && Number.isFinite(row.endMs));
}

async function remindBookings(sql: Sql, rows: { id: string; customer_id: string; advisor_id: string; start_at: string; status: string; reminded_customer: string; reminded_advisor: string; name?: string }[]) {
  const policy = await readJson(sql, "bookings", BOOKING_FALLBACK);
  const marks = (Array.isArray(policy.reminders) ? policy.reminders : [60, 15]).map((n) => Math.floor(Number(n) || 0)).filter((n) => n > 0);
  const now = Date.now();
  for (const row of rows) {
    if (row.status !== "accepted") continue;
    const start = new Date(row.start_at).getTime();
    const minutes = Math.round((start - now) / 60000);
    if (minutes < 0) continue;
    for (const mark of marks) {
      if (minutes > mark) continue;
      const token = String(mark);
      if (!String(row.reminded_customer || "").split(",").includes(token)) {
        const name = row.name || "your psychic";
        await sql`
          insert into ora_customer_alerts (id, user_id, advisor_id, kind, title, body, href)
          values (
            ${rid("alrt")}, ${row.customer_id}, ${row.advisor_id}, 'booking',
            ${"Reading reminder"},
            ${`Your reading with ${name} starts in about ${mark} minutes.`},
            '/scheduled'
          )
        `.catch(() => {});
        row.reminded_customer = [row.reminded_customer, token].filter(Boolean).join(",");
        await sql`update ora_scheduled_readings set reminded_customer = ${row.reminded_customer} where id = ${row.id}`;
      }
      if (!String(row.reminded_advisor || "").split(",").includes(token)) {
        const note = `Scheduled reading ${row.id}`;
        const [existing] = await sql<{ id: string }>`
          select id from ora_advisor_reminders where advisor_id = ${row.advisor_id} and note = ${note} limit 1
        `.catch(() => []);
        if (!existing) {
          await sql`
            insert into ora_advisor_reminders (id, advisor_id, customer_id, due_at, note)
            values (${rid("rem")}, ${row.advisor_id}, ${row.customer_id}, ${row.start_at}, ${note})
          `.catch(() => {});
        }
        row.reminded_advisor = [row.reminded_advisor, token].filter(Boolean).join(",");
        await sql`update ora_scheduled_readings set reminded_advisor = ${row.reminded_advisor} where id = ${row.id}`;
      }
    }
  }
}

function mapBooking(row: {
  id: string;
  customer_id?: string;
  advisor_id: string;
  start_at: string;
  end_at: string;
  duration_min: number;
  note: string;
  status: string;
  proposed_start?: string | null;
  name?: string;
  slug?: string;
}) {
  return {
    id: row.id,
    customerId: row.customer_id || "",
    advisorId: row.advisor_id,
    advisorName: row.name || "",
    advisorSlug: row.slug || "",
    startAt: String(row.start_at),
    endAt: String(row.end_at),
    durationMin: Number(row.duration_min) || 0,
    note: row.note || "",
    status: row.status,
    proposedStart: row.proposed_start ? String(row.proposed_start) : "",
  };
}

export const getAdvancedFlags = createServerFn({ method: "GET" }).handler(async () => advancedFlags());

export const listBookingSlots = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; date?: string; duration?: number }) => ({
    advisorId: clip(input?.advisorId, 80),
    date: clip(input?.date, 10),
    duration: Number(input?.duration) || 15,
  }))
  .handler(async ({ data }) => {
    advancedDisabled("schedule");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !isSlotDuration(data.duration)) return { slots: [], timezone: "UTC" };
    const sql = await getSql();
    const advisor = await advisorByRef(sql, data.advisorId);
    if (!advisor) return { slots: [], timezone: "UTC" };
    const avail = await loadAvailability(sql, advisor.id);
    if (!avail) return { slots: [], timezone: "UTC", advisorName: advisor.name };
    const policy = await readJson(sql, "bookings", BOOKING_FALLBACK);
    const dayStart = wallTimeToUtcMs(data.date, "00:00", avail.timezone);
    const dayEnd = dayStart + 24 * 3600 * 1000;
    const busy = await busyRanges(sql, advisor.id, new Date(dayStart).toISOString(), new Date(dayEnd).toISOString());
    const slots = buildSlots({
      date: data.date,
      timeZone: avail.timezone,
      windows: windowsFor(avail, data.date),
      durationMin: data.duration,
      nowMs: Date.now(),
      leadMin: Number(policy.leadMinutes) || 15,
      busy,
    });
    return {
      timezone: avail.timezone,
      advisorName: advisor.name,
      slots: slots.map((slot) => ({ startAt: new Date(slot.startMs).toISOString(), endAt: new Date(slot.endMs).toISOString() })),
    };
  });

export const bookReading = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { advisorId?: string; startAt?: string; duration?: number; note?: string; customerTz?: string }) => ({
    advisorId: clip(input?.advisorId, 80),
    startAt: iso(input?.startAt),
    duration: Number(input?.duration) || 0,
    note: clip(input?.note, 500),
    customerTz: clip(input?.customerTz, 80),
  }))
  .handler(async ({ context, data }) => {
    advancedDisabled("schedule");
    await ensureAccount(context.userId, await authName(context.userId));
    if (!isSlotDuration(data.duration) || !data.startAt) throw new Error("Choose a time and a 10, 15, 20, or 30 minute sitting.");
    const sql = await getSql();
    const policy = await readJson(sql, "bookings", BOOKING_FALLBACK);
    if (!policy.enabled) throw new Error("Scheduling is turned off right now.");
    const advisor = await advisorByRef(sql, data.advisorId);
    if (!advisor) throw new Error("That advisor is not available to book.");
    if (advisor.id && (await sql<{ user_id: string }>`select user_id from ora_advisors where id = ${advisor.id}`)[0]?.user_id === context.userId) {
      throw new Error("You cannot book yourself.");
    }
    const avail = await loadAvailability(sql, advisor.id);
    if (!avail) throw new Error("This advisor has not opened a schedule.");
    const startMs = new Date(data.startAt).getTime();
    const date = localDate(startMs, avail.timezone);
    const dayStart = wallTimeToUtcMs(date, "00:00", avail.timezone);
    const busy = await busyRanges(sql, advisor.id, new Date(dayStart).toISOString(), new Date(dayStart + 86400000).toISOString());
    const slots = buildSlots({
      date,
      timeZone: avail.timezone,
      windows: windowsFor(avail, date),
      durationMin: data.duration,
      nowMs: Date.now(),
      leadMin: Number(policy.leadMinutes) || 15,
      busy,
    });
    if (!slots.some((slot) => Math.abs(slot.startMs - startMs) < 1000)) throw new Error("That time is no longer open.");
    const endAt = new Date(startMs + data.duration * 60000).toISOString();
    const id = rid("book");
    const inserted = await sql<{ id: string }>`
      insert into ora_scheduled_readings (
        id, customer_id, advisor_id, start_at, end_at, duration_min, note, status, customer_tz
      )
      select ${id}, ${context.userId}, ${advisor.id}, ${data.startAt}::timestamptz, ${endAt}::timestamptz,
             ${data.duration}, ${data.note}, 'pending', ${data.customerTz}
      where not exists (
        select 1 from ora_scheduled_readings
        where advisor_id = ${advisor.id}
          and status in ('pending', 'accepted', 'reschedule_requested')
          and start_at < ${endAt}::timestamptz
          and end_at > ${data.startAt}::timestamptz
      )
      returning id
    `;
    if (!inserted.length) throw new Error("That time was just taken. Pick another.");
    return { id, status: "pending" as const };
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("schedule");
    const sql = await getSql();
    await sql`
      update ora_scheduled_readings set status = 'missed', updated_at = now()
      where customer_id = ${context.userId} and status = 'accepted' and end_at < now() - interval '10 minutes'
    `.catch(() => {});
    const rows = await sql<{
      id: string; advisor_id: string; start_at: string; end_at: string; duration_min: number; note: string;
      status: string; proposed_start: string | null; name: string; slug: string; customer_id: string;
      reminded_customer: string; reminded_advisor: string;
    }>`
      select b.id, b.customer_id, b.advisor_id, b.start_at, b.end_at, b.duration_min, b.note, b.status,
             b.proposed_start, b.reminded_customer, b.reminded_advisor, a.name, a.slug
      from ora_scheduled_readings b
      join ora_advisors a on a.id = b.advisor_id
      where b.customer_id = ${context.userId}
      order by b.start_at asc
      limit 80
    `;
    await remindBookings(sql, rows);
    return { bookings: rows.map(mapBooking) };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: clip(input?.id, 64) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("schedule");
    const sql = await getSql();
    const policy = await readJson(sql, "bookings", BOOKING_FALLBACK);
    const [row] = await sql<{ id: string; start_at: string; status: string }>`
      select id, start_at, status from ora_scheduled_readings
      where id = ${data.id} and customer_id = ${context.userId}
    `;
    if (!row || !bookingOccupies(row.status)) throw new Error("That appointment cannot be cancelled.");
    if (!canCustomerCancel(new Date(row.start_at).getTime(), Date.now(), Number(policy.cancelHours) || 2)) {
      throw new Error("This is inside the cancellation window. Message support if you need help.");
    }
    await sql`update ora_scheduled_readings set status = 'cancelled', updated_at = now() where id = ${row.id}`;
    return { ok: true as const };
  });

export const requestReschedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; startAt?: string }) => ({ id: clip(input?.id, 64), startAt: iso(input?.startAt) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("schedule");
    if (!data.startAt) throw new Error("Choose a new time.");
    const sql = await getSql();
    const updated = await sql<{ id: string }>`
      update ora_scheduled_readings
      set status = 'reschedule_requested', proposed_start = ${data.startAt}::timestamptz,
          proposed_end = ${data.startAt}::timestamptz + (duration_min * interval '1 minute'),
          updated_at = now()
      where id = ${data.id} and customer_id = ${context.userId} and status in ('pending', 'accepted')
      returning id
    `;
    if (!updated.length) throw new Error("That appointment cannot be moved.");
    return { ok: true as const };
  });

export const getBookingAvailability = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("schedule");
    const advisor = await advisorFor(context.userId, "read");
    const sql = await getSql();
    const avail = (await loadAvailability(sql, advisor.id)) || { timezone: "UTC", days: {} as Record<string, DayWindow[]> };
    return avail;
  });

export const saveBookingAvailability = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { timezone?: string; days?: Record<string, unknown> }) => ({
    timezone: clip(input?.timezone, 80) || "UTC",
    days: input?.days && typeof input.days === "object" ? input.days : {},
  }))
  .handler(async ({ context, data }) => {
    advancedDisabled("schedule");
    const advisor = await advisorFor(context.userId, "write");
    const avail = parseAvailability(JSON.stringify({ timezone: data.timezone, days: data.days }), data.timezone);
    const sql = await getSql();
    const json = JSON.stringify(avail);
    await sql`
      insert into ora_booking_availability (advisor_id, timezone, windows_json, updated_at)
      values (${advisor.id}, ${avail.timezone}, ${json}, now())
      on conflict (advisor_id) do update
      set timezone = excluded.timezone, windows_json = excluded.windows_json, updated_at = now()
    `;
    return avail;
  });

export const listAdvisorBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("schedule");
    const advisor = await advisorFor(context.userId, "read");
    const sql = await getSql();
    await sql`
      update ora_scheduled_readings set status = 'missed', updated_at = now()
      where advisor_id = ${advisor.id} and status = 'accepted' and end_at < now() - interval '10 minutes'
    `.catch(() => {});
    const rows = await sql<{
      id: string; customer_id: string; advisor_id: string; start_at: string; end_at: string; duration_min: number;
      note: string; status: string; proposed_start: string | null; reminded_customer: string; reminded_advisor: string;
      display_name: string;
    }>`
      select b.id, b.customer_id, b.advisor_id, b.start_at, b.end_at, b.duration_min, b.note, b.status,
             b.proposed_start, b.reminded_customer, b.reminded_advisor, coalesce(p.display_name, 'Customer') as display_name
      from ora_scheduled_readings b
      left join ora_profiles p on p.user_id = b.customer_id
      where b.advisor_id = ${advisor.id}
      order by b.start_at asc
      limit 100
    `;
    await remindBookings(sql, rows.map((row) => ({ ...row, name: advisor.name })));
    return {
      bookings: rows.map((row) => ({ ...mapBooking(row), customerName: row.display_name || "Customer" })),
    };
  });

export const decideBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; action?: string }) => ({
    id: clip(input?.id, 64),
    action: clip(input?.action, 24),
  }))
  .handler(async ({ context, data }) => {
    advancedDisabled("schedule");
    const advisor = await advisorFor(context.userId, "write");
    const sql = await getSql();
    const [row] = await sql<{ id: string; status: string; proposed_start: string | null; proposed_end: string | null; start_at: string; end_at: string }>`
      select id, status, proposed_start, proposed_end, start_at, end_at
      from ora_scheduled_readings where id = ${data.id} and advisor_id = ${advisor.id}
    `;
    if (!row) throw new Error("Appointment not found.");
    if (data.action === "decline") {
      await sql`update ora_scheduled_readings set status = 'declined', updated_at = now() where id = ${row.id}`;
      return { ok: true as const, status: "declined" };
    }
    if (data.action === "missed" || data.action === "completed" || data.action === "cancelled") {
      await sql`update ora_scheduled_readings set status = ${data.action}, updated_at = now() where id = ${row.id}`;
      return { ok: true as const, status: data.action };
    }
    if (data.action !== "accept") throw new Error("Choose accept, decline, completed, or missed.");
    const start = row.status === "reschedule_requested" && row.proposed_start ? row.proposed_start : row.start_at;
    const end = row.status === "reschedule_requested" && row.proposed_end ? row.proposed_end : row.end_at;
    const clash = await sql<{ id: string }>`
      select id from ora_scheduled_readings
      where advisor_id = ${advisor.id} and id <> ${row.id}
        and status in ('pending', 'accepted', 'reschedule_requested')
        and start_at < ${end}::timestamptz and end_at > ${start}::timestamptz
      limit 1
    `;
    if (clash.length) throw new Error("That time overlaps another appointment.");
    await sql`
      update ora_scheduled_readings
      set status = 'accepted', start_at = ${start}::timestamptz, end_at = ${end}::timestamptz,
          proposed_start = null, proposed_end = null, updated_at = now()
      where id = ${row.id}
    `;
    return { ok: true as const, status: "accepted" };
  });

export async function onlineAlertGate(input: { userId: string; advisorId: string }) {
  if (!flagOn("onlineAlerts")) return { allow: true, body: "" };
  const sql = await getSql();
  const settings = await readJson(sql, "alerts", ALERT_FALLBACK);
  const cooldown = Math.max(1, Number(settings.cooldownHours) || 6) * 3600 * 1000;
  const [row] = await sql<{ last_notified_at: string | null }>`
    select last_notified_at from ora_favorites
    where user_id = ${input.userId} and advisor_id = ${input.advisorId}
  `.catch(() => []);
  const last = row?.last_notified_at ? new Date(row.last_notified_at).getTime() : null;
  return { allow: alertAllowed(last, Date.now(), cooldown), body: ONLINE_ALERT_COPY };
}

export async function markFavoriteNotified(userId: string, advisorId: string) {
  if (!flagOn("onlineAlerts")) return;
  const sql = await getSql();
  await sql`
    update ora_favorites set last_notified_at = now()
    where user_id = ${userId} and advisor_id = ${advisorId}
  `.catch(() => {});
}

export const listSmartReplies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("smartReplies");
    const advisor = await advisorFor(context.userId, "read");
    const sql = await getSql();
    const rows = await sql<{ id: string; body: string; category: string }>`
      select id, body, coalesce(category, 'general') as category
      from ora_advisor_quick_replies
      where advisor_id = ${advisor.id}
      order by sort_order asc, created_at asc
      limit 30
    `;
    return { replies: parseSmartReplies(rows) };
  });

export const saveSmartReplies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { replies?: unknown }) => ({ replies: parseSmartReplies(input?.replies) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("smartReplies");
    const advisor = await advisorFor(context.userId, "write");
    const sql = await getSql();
    await sql`delete from ora_advisor_quick_replies where advisor_id = ${advisor.id}`;
    let order = 0;
    for (const reply of data.replies) {
      await sql`
        insert into ora_advisor_quick_replies (id, advisor_id, body, sort_order, category)
        values (${rid("qr")}, ${advisor.id}, ${reply.body}, ${order}, ${reply.category})
      `;
      order += 1;
    }
    return { replies: data.replies };
  });

export const rewardStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("rewards");
    await ensureAccount(context.userId, await authName(context.userId));
    const sql = await getSql();
    const settings = await readJson(sql, "rewards", REWARD_FALLBACK);
    const [last] = await sql<{ claimed_at: string; streak_day: number }>`
      select claimed_at, streak_day from ora_daily_reward_claims
      where user_id = ${context.userId}
      order by claimed_at desc
      limit 1
    `.catch(() => []);
    const cooldown = Math.max(1, Number(settings.cooldownHours) || 24) * 3600 * 1000;
    const step = nextStreak({
      lastClaimAt: last ? new Date(last.claimed_at).getTime() : null,
      streak: Number(last?.streak_day) || 0,
      now: Date.now(),
      cooldownMs: cooldown,
    });
    const [wallet] = await sql<{ coins: number; promo_coins: number }>`
      select coins, promo_coins from ora_wallets where user_id = ${context.userId}
    `;
    const history = await sql<{ id: string; claimed_at: string; streak_day: number; coins: number }>`
      select id, claimed_at, streak_day, coins from ora_daily_reward_claims
      where user_id = ${context.userId}
      order by claimed_at desc
      limit 14
    `.catch(() => []);
    return {
      enabled: Boolean(settings.enabled),
      rewards: settings.rewards,
      canClaim: Boolean(settings.enabled) && step.ok,
      nextDay: step.day,
      waitMs: step.waitMs,
      nextCoins: rewardCoinsForDay(step.day, settings.rewards),
      promoCoins: Number(wallet?.promo_coins) || 0,
      coins: Number(wallet?.coins) || 0,
      history: history.map((row) => ({
        id: row.id,
        at: String(row.claimed_at),
        day: Number(row.streak_day) || 0,
        coins: Number(row.coins) || 0,
      })),
    };
  });

export const claimDailyReward = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("rewards");
    await ensureAccount(context.userId, await authName(context.userId));
    const seen = await observation();
    const ipHash = seen.ip ? await sha(seen.ip) : "";
    const deviceHash = seen.userAgent ? await sha(seen.userAgent) : "";
    return withSqlTransaction(async (sql) => {
      const settings = await readJson(sql, "rewards", REWARD_FALLBACK);
      if (!settings.enabled) throw new Error("Daily rewards are turned off.");
      await sql`insert into ora_reward_locks (user_id) values (${context.userId}) on conflict (user_id) do nothing`;
      await sql`select user_id from ora_reward_locks where user_id = ${context.userId} for update`;
      if (ipHash) {
        const [others] = await sql<{ n: number }>`
          select count(distinct user_id)::int as n from ora_daily_reward_claims
          where ip_hash = ${ipHash} and user_id <> ${context.userId}
            and claimed_at > now() - interval '24 hours'
        `;
        if (rewardIpBlocked(Number(others?.n) || 0, Number(settings.maxAccountsPerIp) || 2)) {
          await sql`
            insert into ora_security_events (id, user_id, kind, detail, device, ip_hash)
            values (${rid("sec")}, ${context.userId}, 'reward_ip', 'Blocked extra daily-reward claim', ${seen.device}, ${ipHash})
          `.catch(() => {});
          throw new Error("This reward cannot be claimed from another account on the same network today.");
        }
      }
      const [last] = await sql<{ claimed_at: string; streak_day: number }>`
        select claimed_at, streak_day from ora_daily_reward_claims
        where user_id = ${context.userId}
        order by claimed_at desc
        limit 1
      `;
      const cooldown = Math.max(1, Number(settings.cooldownHours) || 24) * 3600 * 1000;
      const step = nextStreak({
        lastClaimAt: last ? new Date(last.claimed_at).getTime() : null,
        streak: Number(last?.streak_day) || 0,
        now: Date.now(),
        cooldownMs: cooldown,
      });
      if (!step.ok) throw new Error("You already claimed a reward in the last 24 hours.");
      const coins = rewardCoinsForDay(step.day, settings.rewards);
      const id = rid("rew");
      const inserted = await sql<{ id: string }>`
        insert into ora_daily_reward_claims (id, user_id, streak_day, coins, ip_hash, device_hash)
        select ${id}, ${context.userId}, ${step.day}, ${coins}, ${ipHash}, ${deviceHash}
        where not exists (
          select 1 from ora_daily_reward_claims
          where user_id = ${context.userId} and claimed_at > now() - make_interval(secs => ${Math.floor(cooldown / 1000)})
        )
        returning id
      `;
      if (!inserted.length) throw new Error("You already claimed a reward in the last 24 hours.");
      await creditPromo(sql, context.userId, coins, "daily_reward", `Daily reward · day ${step.day} · promo coins`, id);
      return { ok: true as const, day: step.day, coins };
    });
  });

type JournalPayload = { title: string; body: string; mood: string; goal: string };

async function sealJournal(payload: JournalPayload) {
  const { sealText } = await import("./ora-advanced-crypto.server");
  return sealText(JSON.stringify(payload));
}

async function openJournal(sealed: string): Promise<JournalPayload> {
  const { openText } = await import("./ora-advanced-crypto.server");
  const parsed = JSON.parse(openText(sealed)) as JournalPayload;
  return {
    title: clip(parsed.title, 120),
    body: clip(parsed.body, 8000),
    mood: clip(parsed.mood, 40),
    goal: clip(parsed.goal, 240),
  };
}

export const listJournal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("journal");
    const sql = await getSql();
    const rows = await sql<{ id: string; reading_id: string; entry_date: string; sealed: string; updated_at: string }>`
      select id, reading_id, entry_date::text as entry_date, sealed, updated_at
      from ora_journals where user_id = ${context.userId}
      order by entry_date desc, updated_at desc
      limit 200
    `;
    const readings = await sql<{ id: string; name: string; started_at: string }>`
      select r.id, a.name, r.started_at from ora_readings r
      join ora_advisors a on a.id = r.advisor_id
      where r.client_id = ${context.userId} and r.status = 'ended'
      order by r.started_at desc
      limit 30
    `;
    const entries = [];
    for (const row of rows) {
      try {
        const payload = await openJournal(row.sealed);
        entries.push({ id: row.id, readingId: row.reading_id, date: String(row.entry_date).slice(0, 10), updatedAt: String(row.updated_at), ...payload });
      } catch {
        entries.push({ id: row.id, readingId: row.reading_id, date: String(row.entry_date).slice(0, 10), updatedAt: String(row.updated_at), title: "Locked entry", body: "", mood: "", goal: "" });
      }
    }
    return {
      entries,
      readings: readings.map((row) => ({ id: row.id, name: row.name, at: String(row.started_at) })),
    };
  });

export const saveJournal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; title?: string; body?: string; mood?: string; goal?: string; date?: string; readingId?: string }) => ({
    id: clip(input?.id, 64),
    title: clip(input?.title, 120),
    body: clip(input?.body, 8000),
    mood: clip(input?.mood, 40),
    goal: clip(input?.goal, 240),
    date: /^\d{4}-\d{2}-\d{2}$/.test(clip(input?.date, 10)) ? clip(input?.date, 10) : new Date().toISOString().slice(0, 10),
    readingId: clip(input?.readingId, 64),
  }))
  .handler(async ({ context, data }) => {
    advancedDisabled("journal");
    if (!data.title && !data.body) throw new Error("Write a title or a note.");
    const sql = await getSql();
    if (data.readingId) {
      const [own] = await sql<{ id: string }>`
        select id from ora_readings where id = ${data.readingId} and client_id = ${context.userId}
      `;
      if (!own) throw new Error("That reading is not on this account.");
    }
    const sealed = await sealJournal({ title: data.title, body: data.body, mood: data.mood, goal: data.goal });
    if (data.id) {
      const updated = await sql<{ id: string }>`
        update ora_journals
        set sealed = ${sealed}, entry_date = ${data.date}::date, reading_id = ${data.readingId}, updated_at = now()
        where id = ${data.id} and user_id = ${context.userId}
        returning id
      `;
      if (!updated.length) throw new Error("Entry not found.");
      return { id: data.id };
    }
    const id = rid("jrn");
    await sql`
      insert into ora_journals (id, user_id, reading_id, entry_date, sealed)
      values (${id}, ${context.userId}, ${data.readingId}, ${data.date}::date, ${sealed})
    `;
    return { id };
  });

export const deleteJournal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: clip(input?.id, 64) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("journal");
    const sql = await getSql();
    await sql`delete from ora_journals where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

async function referralCodeFor(sql: Sql, userId: string) {
  const [existing] = await sql<{ code: string }>`select code from ora_referral_codes where user_id = ${userId}`;
  if (existing?.code) return existing.code;
  const { randomBytes } = await import("node:crypto");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(6).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
    if (code.length < 6) continue;
    try {
      await sql`insert into ora_referral_codes (user_id, code) values (${userId}, ${code})`;
      return code;
    } catch {
      const [again] = await sql<{ code: string }>`select code from ora_referral_codes where user_id = ${userId}`;
      if (again?.code) return again.code;
    }
  }
  throw new Error("Could not create a referral code.");
}

export const referralHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("referrals");
    await ensureAccount(context.userId, await authName(context.userId));
    const sql = await getSql();
    const settings = await readJson(sql, "referrals", REFERRAL_FALLBACK);
    const code = settings.enabled ? await referralCodeFor(sql, context.userId) : "";
    const rows = await sql<{ id: string; status: string; created_at: string; completed_at: string | null; referrer_coins: number }>`
      select id, status, created_at, completed_at, referrer_coins
      from ora_referrals where referrer_id = ${context.userId}
      order by created_at desc
      limit 40
    `.catch(() => []);
    return {
      enabled: Boolean(settings.enabled),
      code,
      referrerCoins: Number(settings.referrerCoins) || 0,
      referredCoins: Number(settings.referredCoins) || 0,
      referrals: rows.map((row) => ({
        id: row.id,
        status: row.status,
        at: String(row.created_at),
        completedAt: row.completed_at ? String(row.completed_at) : "",
        coins: Number(row.referrer_coins) || 0,
      })),
    };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => ({ code: clip(input?.code, 16).toUpperCase() }))
  .handler(async ({ context, data }) => {
    advancedDisabled("referrals");
    if (!data.code) throw new Error("Enter a referral code.");
    await ensureAccount(context.userId, await authName(context.userId));
    const sql = await getSql();
    const settings = await readJson(sql, "referrals", REFERRAL_FALLBACK);
    if (!settings.enabled) throw new Error("Referrals are turned off.");
    const [owner] = await sql<{ user_id: string }>`select user_id from ora_referral_codes where code = ${data.code}`;
    if (!owner) throw new Error("That code was not found.");
    const [paid] = await sql<{ id: string }>`
      select id from ora_readings
      where client_id = ${context.userId} and status = 'ended' and coins_spent > 0
      limit 1
    `;
    if (paid) throw new Error("Referral codes can only be added before your first paid reading.");
    const [existing] = await sql<{ id: string }>`select id from ora_referrals where referred_user_id = ${context.userId}`;
    if (existing) throw new Error("A referral is already attached to this account.");
    const referrerEmail = await emailOf(sql, owner.user_id);
    const referredEmail = await emailOf(sql, context.userId);
    if (!referralEligible({
      referrerId: owner.user_id,
      referredId: context.userId,
      referrerEmail,
      referredEmail,
      alreadyRewarded: false,
      paidCoins: 1,
    })) {
      throw new Error("You cannot use your own referral code.");
    }
    await sql`
      insert into ora_referrals (id, referrer_id, referred_user_id, code, status)
      values (${rid("ref")}, ${owner.user_id}, ${context.userId}, ${data.code}, 'pending')
    `;
    return { ok: true as const, status: "pending" as const };
  });

export async function notePaidReading(readingId: string) {
  if (!flagOn("referrals")) return;
  try {
    const sql = await getSql();
    const [reading] = await sql<{ id: string; client_id: string; coins_spent: number; status: string }>`
      select id, client_id, coins_spent, status from ora_readings where id = ${readingId}
    `;
    if (!reading || reading.status !== "ended" || Number(reading.coins_spent) <= 0) return;
    const settings = await readJson(sql, "referrals", REFERRAL_FALLBACK);
    if (!settings.enabled) return;
    await withSqlTransaction(async (tx) => {
      const [ref] = await tx<{ id: string; referrer_id: string; status: string }>`
        select id, referrer_id, status from ora_referrals
        where referred_user_id = ${reading.client_id}
        for update
      `;
      if (!ref || ref.status !== "pending") return;
      const referrerEmail = await emailOf(tx, ref.referrer_id);
      const referredEmail = await emailOf(tx, reading.client_id);
      if (!referralEligible({
        referrerId: ref.referrer_id,
        referredId: reading.client_id,
        referrerEmail,
        referredEmail,
        alreadyRewarded: false,
        paidCoins: Number(reading.coins_spent),
      })) return;
      const claimed = await tx<{ id: string }>`
        update ora_referrals
        set status = 'completed', referrer_coins = ${Number(settings.referrerCoins) || 0},
            referred_coins = ${Number(settings.referredCoins) || 0},
            reading_id = ${reading.id}, completed_at = now()
        where id = ${ref.id} and status = 'pending'
        returning id
      `;
      if (!claimed.length) return;
      await ensureAccount(ref.referrer_id, "Member");
      await ensureAccount(reading.client_id, "Member");
      await creditPromo(tx, ref.referrer_id, Number(settings.referrerCoins) || 0, "referral", "Referral reward · promo coins", ref.id);
      await creditPromo(tx, reading.client_id, Number(settings.referredCoins) || 0, "referral", "Welcome referral · promo coins", ref.id);
    });
  } catch (err) {
    console.error("[ora] referral", err);
  }
}

export const giftCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("gifts");
    const sql = await getSql();
    const settings = await readJson(sql, "gifts", GIFT_FALLBACK);
    const mine = await sql<{ id: string; code: string; coins: number; status: string; message: string; created_at: string }>`
      select id, code, coins, status, message, created_at from ora_reading_gifts
      where buyer_id = ${context.userId}
      order by created_at desc
      limit 20
    `.catch(() => []);
    return {
      purchasesEnabled: false,
      denominations: (Array.isArray(settings.denominations) ? settings.denominations : GIFT_FALLBACK.denominations)
        .map((n) => Math.floor(Number(n) || 0))
        .filter((n) => n > 0)
        .slice(0, 8),
      gifts: mine.map((row) => ({
        id: row.id,
        code: row.code,
        coins: Number(row.coins) || 0,
        status: row.status,
        message: row.message,
        at: String(row.created_at),
      })),
    };
  });

export const createGiftIntent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { coins?: number; message?: string }) => ({
    coins: Math.floor(Number(input?.coins) || 0),
    message: clip(input?.message, 240),
  }))
  .handler(async ({ context, data }) => {
    advancedDisabled("gifts");
    await ensureAccount(context.userId, await authName(context.userId));
    const sql = await getSql();
    const settings = await readJson(sql, "gifts", GIFT_FALLBACK);
    const allowed = (Array.isArray(settings.denominations) ? settings.denominations : []).map((n) => Math.floor(Number(n) || 0));
    if (!allowed.includes(data.coins)) throw new Error("Choose a listed gift amount.");
    const paymentsOn = process.env["ORA_GIFT_PAYMENTS"] === "1";
    if (giftPurchaseLocked(Boolean(settings.purchasesEnabled), paymentsOn)) {
      const { randomBytes } = await import("node:crypto");
      const code = `GIFT-${randomBytes(6).toString("hex").toUpperCase()}`;
      const id = rid("gift");
      await sql`
        insert into ora_reading_gifts (id, code, buyer_id, coins, message, status)
        values (${id}, ${code}, ${context.userId}, ${data.coins}, ${data.message}, 'unpaid')
      `;
      return {
        id,
        code,
        status: "unpaid" as const,
        message: "Gift purchases are not active yet. This code cannot be redeemed until a verified payment is recorded.",
      };
    }
    throw new Error("Gift checkout is not connected.");
  });

export const redeemGift = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => ({ code: clip(input?.code, 40).toUpperCase() }))
  .handler(async ({ context, data }) => {
    advancedDisabled("gifts");
    await ensureAccount(context.userId, await authName(context.userId));
    return withSqlTransaction(async (sql) => {
      const [gift] = await sql<{ id: string; status: string; coins: number; buyer_id: string }>`
        select id, status, coins, buyer_id from ora_reading_gifts where code = ${data.code} for update
      `;
      if (!gift) throw new Error("Gift code not found.");
      if (!giftRedeemAllowed(gift.status)) {
        if (gift.status === "unpaid") throw new Error("Gift purchases are not active yet.");
        throw new Error("This gift cannot be redeemed.");
      }
      if (gift.buyer_id === context.userId) throw new Error("You cannot redeem a gift you created.");
      const updated = await sql<{ id: string }>`
        update ora_reading_gifts
        set status = 'redeemed', redeemed_by = ${context.userId}, redeemed_at = now()
        where id = ${gift.id} and status = 'paid'
        returning id
      `;
      if (!updated.length) throw new Error("This gift was already redeemed.");
      await creditPromo(sql, context.userId, Number(gift.coins) || 0, "gift_redeem", "Gift reading · promo coins", gift.id);
      return { ok: true as const, coins: Number(gift.coins) || 0 };
    });
  });

async function performanceFor(sql: Sql, advisorId: string, range: string, now = Date.now()) {
  const start = rangeStartMs(range, now);
  const since = start == null ? "1970-01-01T00:00:00.000Z" : new Date(start).toISOString();
  const [paid] = await sql<{ n: number; clients: number }>`
    select count(*)::int as n, count(distinct client_id)::int as clients
    from ora_readings
    where advisor_id = ${advisorId} and status = 'ended' and coins_spent > 0 and started_at >= ${since}::timestamptz
  `.catch(() => [{ n: 0, clients: 0 }]);
  const [returning] = await sql<{ n: number }>`
    select count(*)::int as n from (
      select client_id from ora_readings
      where advisor_id = ${advisorId} and status = 'ended' and coins_spent > 0 and started_at >= ${since}::timestamptz
      group by client_id having count(*) >= 2
    ) t
  `.catch(() => [{ n: 0 }]);
  const [rating] = await sql<{ avg: number | null; n: number }>`
    select avg(rating)::float as avg, count(*)::int as n from ora_reviews
    where advisor_id = ${advisorId} and created_at >= ${since}::timestamptz
  `.catch(() => [{ avg: null, n: 0 }]);
  const [response] = await sql<{ avg: number | null }>`
    select avg(extract(epoch from (r.started_at - q.created_at)))::float as avg
    from ora_chat_requests q
    join ora_readings r on r.id = q.reading_id
    where q.advisor_id = ${advisorId} and q.status = 'accepted' and r.started_at >= ${since}::timestamptz
      and r.started_at >= q.created_at
  `.catch(() => [{ avg: null }]);
  const [accepted] = await sql<{ n: number }>`
    select count(*)::int as n from ora_chat_requests
    where advisor_id = ${advisorId} and status = 'accepted' and created_at >= ${since}::timestamptz
  `.catch(() => [{ n: 0 }]);
  const [missed] = await sql<{ n: number }>`
    select count(*)::int as n from ora_missed_chat_penalties
    where advisor_id = ${advisorId} and created_at >= ${since}::timestamptz
  `.catch(() => [{ n: 0 }]);
  const [online] = await sql<{ seconds: number }>`
    select coalesce(sum(seconds), 0)::int as seconds from ora_advisor_presence
    where advisor_id = ${advisorId} and started_at >= ${since}::timestamptz
  `.catch(() => [{ seconds: 0 }]);
  const [scheduled] = await sql<{ n: number }>`
    select count(*)::int as n from ora_scheduled_readings
    where advisor_id = ${advisorId} and status = 'completed' and start_at >= ${since}::timestamptz
  `.catch(() => [{ n: 0 }]);
  const rangeSeconds = start == null ? 90 * 86400 : Math.max(86400, Math.floor((now - start) / 1000));
  const input: PerformanceInput = {
    paidCompleted: Number(paid?.n) || 0,
    returningClients: Number(returning?.n) || 0,
    distinctClients: Number(paid?.clients) || 0,
    avgRating: rating?.avg == null ? null : Number(rating.avg),
    ratingCount: Number(rating?.n) || 0,
    avgResponseSeconds: response?.avg == null ? null : Number(response.avg),
    accepted: Number(accepted?.n) || 0,
    missed: Number(missed?.n) || 0,
    onlineSeconds: Number(online?.seconds) || 0,
    scheduledCompleted: Number(scheduled?.n) || 0,
    rangeSeconds,
  };
  return { ...performanceScore(input), metrics: input };
}

export const advisorPerformance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { range?: string }) => ({ range: clip(input?.range, 8) || "30" }))
  .handler(async ({ context, data }) => {
    advancedDisabled("performance");
    const advisor = await advisorFor(context.userId, "read");
    const sql = await getSql();
    const score = await performanceFor(sql, advisor.id, data.range === "all" || data.range === "today" || data.range === "7" || data.range === "90" ? data.range : "30");
    return { range: data.range, ...score, public: false as const };
  });

function maskIp(ip: string) {
  const value = ip.trim();
  if (!value) return "";
  const parts = value.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  if (value.includes(":")) return `${value.split(":").slice(0, 3).join(":")}:…`;
  return "hidden";
}

export const securityOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("security");
    const sql = await getSql();
    const seen = await observation();
    const sessions = await sql<{
      id: string; token: string; createdAt: string; updatedAt: string; expiresAt: string; ipAddress: string | null; userAgent: string | null;
    }>`
      select "id", "token", "createdAt", "updatedAt", "expiresAt", "ipAddress", "userAgent"
      from "session" where "userId" = ${context.userId}
      order by "updatedAt" desc
      limit 12
    `.catch(() => []);
    const { createHash } = await import("node:crypto");
    const mapped = sessions.map((row) => {
      const key = row.token ? createHash("sha256").update(String(row.token)).digest("hex") : "";
      return {
        id: row.id,
        current: Boolean(seen.sessionKey) && key === seen.sessionKey,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
        expiresAt: String(row.expiresAt),
        device: deviceLabel(String(row.userAgent || "")),
        ip: maskIp(String(row.ipAddress || "")),
      };
    });
    if (seen.userAgent) {
      const known = sessions.some((row) => String(row.userAgent || "") === seen.userAgent && new Date(row.createdAt).getTime() < Date.now() - 60_000);
      const fresh = sessions.some((row) => String(row.userAgent || "") === seen.userAgent && Date.now() - new Date(row.createdAt).getTime() < 24 * 3600 * 1000);
      if (fresh && !known) {
        const [dup] = await sql<{ id: string }>`
          select id from ora_security_events
          where user_id = ${context.userId} and kind = 'new_device' and device = ${seen.device}
            and created_at > now() - interval '24 hours'
          limit 1
        `.catch(() => []);
        if (!dup) {
          await sql`
            insert into ora_security_events (id, user_id, kind, detail, device, ip_hash)
            values (${rid("sec")}, ${context.userId}, 'new_device', 'New device sign-in', ${seen.device}, ${seen.ip ? await sha(seen.ip) : ""})
          `.catch(() => {});
          await sql`
            insert into ora_customer_alerts (id, user_id, advisor_id, kind, title, body, href)
            values (
              ${rid("alrt")}, ${context.userId}, '', 'security',
              'New sign-in',
              ${`A new device signed in (${seen.device}). If this was not you, sign out of other devices.`},
              '/security'
            )
          `.catch(() => {});
        }
      }
    }
    const events = await sql<{ id: string; kind: string; detail: string; device: string; created_at: string }>`
      select id, kind, detail, device, created_at from ora_security_events
      where user_id = ${context.userId}
      order by created_at desc
      limit 20
    `.catch(() => []);
    const [totp] = await sql<{ enabled: boolean }>`select enabled from ora_totp where user_id = ${context.userId}`.catch(() => []);
    const [profile] = await sql<{ role: string }>`select role from ora_profiles where user_id = ${context.userId}`.catch(() => []);
    return {
      role: profile?.role || "customer",
      totpEnabled: Boolean(totp?.enabled),
      sessions: mapped,
      events: events.map((row) => ({ id: row.id, kind: row.kind, detail: row.detail, device: row.device, at: String(row.created_at) })),
    };
  });

async function totpFailures(sql: Sql, userId: string) {
  const [row] = await sql<{ n: number }>`
    select count(*)::int as n from ora_security_events
    where user_id = ${userId} and kind = 'totp_fail' and created_at > now() - interval '15 minutes'
  `.catch(() => [{ n: 0 }]);
  if ((Number(row?.n) || 0) >= 5) throw new Error("Too many code attempts. Wait a few minutes.");
}

export const beginTotp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    advancedDisabled("security");
    const sql = await getSql();
    const [existing] = await sql<{ enabled: boolean }>`select enabled from ora_totp where user_id = ${context.userId}`;
    if (existing?.enabled) throw new Error("Two-factor authentication is already on.");
    const { makeTotpSecret, sealText } = await import("./ora-advanced-crypto.server");
    const secret = makeTotpSecret();
    await sql`
      insert into ora_totp (user_id, secret_sealed, enabled)
      values (${context.userId}, ${sealText(secret)}, false)
      on conflict (user_id) do update set secret_sealed = excluded.secret_sealed, enabled = false
    `;
    const email = await emailOf(sql, context.userId);
    return {
      secret,
      otpauth: `otpauth://totp/Ora%20Psychic:${encodeURIComponent(email || "account")}?secret=${secret}&issuer=Ora%20Psychic`,
    };
  });

export const confirmTotp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => ({ code: clip(input?.code, 8) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("security");
    const sql = await getSql();
    await totpFailures(sql, context.userId);
    const [row] = await sql<{ secret_sealed: string }>`select secret_sealed from ora_totp where user_id = ${context.userId}`;
    if (!row) throw new Error("Start setup first.");
    const { openText, verifyTotp } = await import("./ora-advanced-crypto.server");
    const secret = openText(row.secret_sealed);
    if (!verifyTotp(secret, data.code)) {
      await sql`
        insert into ora_security_events (id, user_id, kind, detail, device, ip_hash)
        values (${rid("sec")}, ${context.userId}, 'totp_fail', 'Bad authenticator code', '', '')
      `;
      throw new Error("That code did not match.");
    }
    await sql`update ora_totp set enabled = true where user_id = ${context.userId}`;
    await auditLog(context.userId, "totp_on", "user", context.userId, "enabled");
    return { ok: true as const };
  });

export const disableTotp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code?: string }) => ({ code: clip(input?.code, 8) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("security");
    const sql = await getSql();
    await totpFailures(sql, context.userId);
    const [row] = await sql<{ secret_sealed: string; enabled: boolean }>`
      select secret_sealed, enabled from ora_totp where user_id = ${context.userId}
    `;
    if (!row?.enabled) return { ok: true as const };
    const { openText, verifyTotp } = await import("./ora-advanced-crypto.server");
    if (!verifyTotp(openText(row.secret_sealed), data.code)) throw new Error("That code did not match.");
    await sql`delete from ora_totp where user_id = ${context.userId}`;
    await auditLog(context.userId, "totp_off", "user", context.userId, "disabled");
    return { ok: true as const };
  });

export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input?: { code?: string }) => ({ code: clip(input?.code, 8) }))
  .handler(async ({ context, data }) => {
    advancedDisabled("security");
    const sql = await getSql();
    const [totp] = await sql<{ secret_sealed: string; enabled: boolean }>`
      select secret_sealed, enabled from ora_totp where user_id = ${context.userId}
    `.catch(() => []);
    if (totp?.enabled) {
      await totpFailures(sql, context.userId);
      const { openText, verifyTotp } = await import("./ora-advanced-crypto.server");
      if (!verifyTotp(openText(totp.secret_sealed), data.code || "")) throw new Error("Enter your authenticator code.");
    }
    const seen = await observation();
    const { createHash } = await import("node:crypto");
    const sessions = await sql<{ id: string; token: string; updatedAt: string }>`
      select "id", "token", "updatedAt" from "session" where "userId" = ${context.userId}
    `;
    const current = sessions.find((row) => createHash("sha256").update(String(row.token)).digest("hex") === seen.sessionKey);
    const newest = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const keep = current?.id || newest?.id || "";
    if (!keep) return { ok: true as const, revoked: 0 };
    const removed = await sql<{ id: string }>`
      delete from "session" where "userId" = ${context.userId} and "id" <> ${keep} returning "id"
    `;
    await sql`
      insert into ora_security_events (id, user_id, kind, detail, device, ip_hash)
      values (${rid("sec")}, ${context.userId}, 'revoke_sessions', ${`Signed out ${removed.length} other device(s)`}, ${seen.device}, '')
    `.catch(() => {});
    return { ok: true as const, revoked: removed.length };
  });

export const noteChatRecovery = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { readingId?: string; kind?: string }) => ({
    readingId: clip(input?.readingId, 64),
    kind: clip(input?.kind, 24) || "reconnected",
  }))
  .handler(async ({ context, data }) => {
    if (!flagOn("chatRecovery")) return { ok: true as const, skipped: true as const };
    const sql = await getSql();
    const [row] = await sql<{ id: string }>`
      select r.id from ora_readings r
      left join ora_advisors a on a.id = r.advisor_id
      where r.id = ${data.readingId} and (r.client_id = ${context.userId} or a.user_id = ${context.userId})
    `;
    if (!row) return { ok: false as const };
    await sql`
      insert into ora_chat_recovery_events (id, reading_id, user_id, kind)
      values (${rid("rcv")}, ${data.readingId}, ${context.userId}, ${data.kind})
    `.catch(() => {});
    return { ok: true as const };
  });

export const adminAdvancedBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, "overview");
    const flags = advancedFlags();
    if (!Object.values(flags).some(Boolean)) return { enabled: false as const, flags };
    const sql = await getSql();
    const bookings = flags.schedule
      ? await sql<{ id: string; status: string; start_at: string; name: string; customer: string }>`
          select b.id, b.status, b.start_at, a.name, coalesce(p.display_name, 'Customer') as customer
          from ora_scheduled_readings b
          join ora_advisors a on a.id = b.advisor_id
          left join ora_profiles p on p.user_id = b.customer_id
          order by b.start_at desc
          limit 40
        `.catch(() => [])
      : [];
    const rewards = flags.rewards ? await readJson(sql, "rewards", REWARD_FALLBACK) : REWARD_FALLBACK;
    const suspicious = flags.rewards
      ? await sql<{ ip_hash: string; n: number }>`
          select ip_hash, count(distinct user_id)::int as n from ora_daily_reward_claims
          where ip_hash <> '' and claimed_at > now() - interval '24 hours'
          group by ip_hash having count(distinct user_id) > 1
          limit 20
        `.catch(() => [])
      : [];
    const referrals = flags.referrals ? await readJson(sql, "referrals", REFERRAL_FALLBACK) : REFERRAL_FALLBACK;
    const referralRows = flags.referrals
      ? await sql<{ id: string; status: string; created_at: string; referrer_coins: number }>`
          select id, status, created_at, referrer_coins from ora_referrals order by created_at desc limit 30
        `.catch(() => [])
      : [];
    const gifts = flags.gifts ? await readJson(sql, "gifts", GIFT_FALLBACK) : GIFT_FALLBACK;
    const giftRows = flags.gifts
      ? await sql<{ id: string; code: string; coins: number; status: string; created_at: string }>`
          select id, code, coins, status, created_at from ora_reading_gifts order by created_at desc limit 30
        `.catch(() => [])
      : [];
    const recovery = flags.chatRecovery
      ? await sql<{ n: number }>`select count(*)::int as n from ora_chat_recovery_events where created_at > now() - interval '24 hours'`.catch(() => [{ n: 0 }])
      : [{ n: 0 }];
    const security = flags.security
      ? await sql<{ n: number }>`select count(*)::int as n from ora_security_events where created_at > now() - interval '24 hours'`.catch(() => [{ n: 0 }])
      : [{ n: 0 }];
    const scores = flags.performance
      ? await (async () => {
          const advisors = await sql<{ id: string; name: string }>`select id, name from ora_advisors where status = 'live' order by name asc limit 40`;
          const out = [];
          for (const advisor of advisors) {
            const score = await performanceFor(sql, advisor.id, "30");
            out.push({ id: advisor.id, name: advisor.name, score: score.score, sample: score.sample, missed: score.metrics.missed });
          }
          return out;
        })()
      : [];
    return {
      enabled: true as const,
      flags,
      bookings: bookings.map((row) => ({ id: row.id, status: row.status, startAt: String(row.start_at), advisor: row.name, customer: row.customer })),
      bookingPolicy: await readJson(sql, "bookings", BOOKING_FALLBACK),
      rewards,
      suspicious: suspicious.map((row) => ({ accounts: Number(row.n) || 0 })),
      referrals,
      referralRows: referralRows.map((row) => ({ id: row.id, status: row.status, at: String(row.created_at), coins: Number(row.referrer_coins) || 0 })),
      gifts: { ...gifts, purchasesEnabled: false },
      giftRows: giftRows.map((row) => ({ id: row.id, code: row.code, coins: Number(row.coins) || 0, status: row.status, at: String(row.created_at) })),
      recoveryEvents: Number(recovery[0]?.n) || 0,
      securityEvents: Number(security[0]?.n) || 0,
      scores,
      alertCooldownHours: Number((await readJson(sql, "alerts", ALERT_FALLBACK)).cooldownHours) || 6,
    };
  });

export const saveAdvancedSetting = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { key?: string; value?: unknown }) => ({
    key: clip(input?.key, 40),
    value: input?.value,
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    const sql = await getSql();
    if (data.key === "rewards") {
      advancedDisabled("rewards");
      const current = await readJson(sql, "rewards", REWARD_FALLBACK);
      const value = (data.value || {}) as Partial<RewardSettings>;
      const rewards = Array.isArray(value.rewards) ? value.rewards.map((n) => Math.max(0, Math.floor(Number(n) || 0))).slice(0, 7) : current.rewards;
      const next = {
        enabled: value.enabled == null ? current.enabled : Boolean(value.enabled),
        rewards: rewards.length === 7 ? rewards : current.rewards,
        cooldownHours: Math.min(72, Math.max(1, Math.floor(Number(value.cooldownHours ?? current.cooldownHours) || 24))),
        maxAccountsPerIp: Math.min(10, Math.max(1, Math.floor(Number(value.maxAccountsPerIp ?? current.maxAccountsPerIp) || 2))),
      };
      await writeJson(sql, "rewards", next);
      await auditLog(context.userId, "rewards_settings", "settings", "rewards", JSON.stringify(next));
      return next;
    }
    if (data.key === "referrals") {
      advancedDisabled("referrals");
      const current = await readJson(sql, "referrals", REFERRAL_FALLBACK);
      const value = (data.value || {}) as Partial<ReferralSettings>;
      const next = {
        enabled: value.enabled == null ? current.enabled : Boolean(value.enabled),
        referrerCoins: Math.min(100, Math.max(0, Math.floor(Number(value.referrerCoins ?? current.referrerCoins) || 0))),
        referredCoins: Math.min(100, Math.max(0, Math.floor(Number(value.referredCoins ?? current.referredCoins) || 0))),
      };
      await writeJson(sql, "referrals", next);
      await auditLog(context.userId, "referral_settings", "settings", "referrals", JSON.stringify(next));
      return next;
    }
    if (data.key === "bookings") {
      advancedDisabled("schedule");
      const current = await readJson(sql, "bookings", BOOKING_FALLBACK);
      const value = (data.value || {}) as Partial<typeof BOOKING_FALLBACK>;
      const next = {
        enabled: value.enabled == null ? current.enabled : Boolean(value.enabled),
        cancelHours: Math.min(72, Math.max(0, Math.floor(Number(value.cancelHours ?? current.cancelHours) || 0))),
        leadMinutes: Math.min(240, Math.max(0, Math.floor(Number(value.leadMinutes ?? current.leadMinutes) || 0))),
        reminders: [60, 15],
      };
      await writeJson(sql, "bookings", next);
      await auditLog(context.userId, "booking_policy", "settings", "bookings", JSON.stringify(next));
      return next;
    }
    if (data.key === "alerts") {
      advancedDisabled("onlineAlerts");
      const hours = Math.min(72, Math.max(1, Math.floor(Number((data.value as { cooldownHours?: number })?.cooldownHours) || 6)));
      await writeJson(sql, "alerts", { cooldownHours: hours });
      await auditLog(context.userId, "alert_cooldown", "settings", "alerts", String(hours));
      return { cooldownHours: hours };
    }
    if (data.key === "gifts") {
      advancedDisabled("gifts");
      const value = (data.value || {}) as Partial<GiftSettings>;
      const denominations = Array.isArray(value.denominations)
        ? value.denominations.map((n) => Math.floor(Number(n) || 0)).filter((n) => n > 0).slice(0, 8)
        : GIFT_FALLBACK.denominations;
      const next = { purchasesEnabled: false, denominations };
      await writeJson(sql, "gifts", next);
      await auditLog(context.userId, "gift_settings", "settings", "gifts", JSON.stringify(next));
      return next;
    }
    throw new Error("Unknown setting.");
  });

export const adminGiftAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string; status?: string; paymentRef?: string }) => ({
    id: clip(input?.id, 64),
    status: clip(input?.status, 20),
    paymentRef: clip(input?.paymentRef, 80),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    advancedDisabled("gifts");
    if (!["cancelled", "expired", "refunded", "paid"].includes(data.status)) throw new Error("Unsupported gift status.");
    if (data.status === "paid" && data.paymentRef.length < 4) throw new Error("A verified payment reference is required.");
    const sql = await getSql();
    const [gift] = await sql<{ id: string; status: string; coins: number; redeemed_by: string }>`
      select id, status, coins, redeemed_by from ora_reading_gifts where id = ${data.id}
    `;
    if (!gift) throw new Error("Gift not found.");
    if (data.status === "refunded" && gift.status === "redeemed" && gift.redeemed_by) {
      await withSqlTransaction(async (tx) => {
        await debitPromo(tx, gift.redeemed_by, Number(gift.coins) || 0, "gift_refund", "Gift refund · promo coins", gift.id);
        await tx`update ora_reading_gifts set status = 'refunded' where id = ${gift.id}`;
      });
    } else {
      await sql`
        update ora_reading_gifts
        set status = ${data.status}, payment_ref = case when ${data.status} = 'paid' then ${data.paymentRef} else payment_ref end
        where id = ${gift.id}
      `;
    }
    await auditLog(context.userId, "gift_status", "gift", gift.id, data.status);
    return { ok: true as const };
  });

export const adminReverseReferral = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: clip(input?.id, 64) }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId, "overview");
    advancedDisabled("referrals");
    await withSqlTransaction(async (sql) => {
      const [row] = await sql<{ id: string; status: string; referrer_id: string; referred_user_id: string; referrer_coins: number; referred_coins: number }>`
        select id, status, referrer_id, referred_user_id, referrer_coins, referred_coins
        from ora_referrals where id = ${data.id} for update
      `;
      if (!row) throw new Error("Referral not found.");
      if (row.status === "reversed") return;
      if (row.status === "completed") {
        await debitPromo(sql, row.referrer_id, Number(row.referrer_coins) || 0, "referral_reversal", "Referral reversal · promo coins", row.id);
        await debitPromo(sql, row.referred_user_id, Number(row.referred_coins) || 0, "referral_reversal", "Referral reversal · promo coins", row.id);
      }
      await sql`update ora_referrals set status = 'reversed' where id = ${row.id}`;
    });
    await auditLog(context.userId, "referral_reverse", "referral", data.id, "reversed");
    return { ok: true as const };
  });
