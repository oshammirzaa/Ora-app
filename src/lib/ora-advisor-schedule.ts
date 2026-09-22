export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export type HourPeriod = { start: string; end: string };
export type DayHours = { on: boolean; start: string; end: string; periods: HourPeriod[] };
export type AdvisorHours = Record<WeekdayKey, DayHours> & {
  timezone: string;
  configured: boolean;
};

const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const WEEKDAY_FROM_SHORT: Record<string, WeekdayKey> = {
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
};

export const ADVISOR_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export const MAX_DAY_PERIODS = 3;

export function weekdayLabel(key: WeekdayKey) {
  return WEEKDAY_LABELS[key];
}

export function validHm(value: unknown, fallback = "09:00") {
  const v = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(v) ? v : fallback;
}

export function hmToMinutes(value: string) {
  const hm = validHm(value, "00:00");
  const hours = Number(hm.slice(0, 2));
  const minutes = Number(hm.slice(3, 5));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.min(24 * 60, Math.max(0, hours * 60 + minutes));
}

function emptyDay(): DayHours {
  return { on: false, start: "09:00", end: "17:00", periods: [{ start: "09:00", end: "17:00" }] };
}

export function emptyAdvisorHours(timezone = "UTC"): AdvisorHours {
  return {
    timezone: normalizeAdvisorTimezone(timezone),
    configured: false,
    mon: emptyDay(),
    tue: emptyDay(),
    wed: emptyDay(),
    thu: emptyDay(),
    fri: emptyDay(),
    sat: emptyDay(),
    sun: emptyDay(),
  };
}

export function normalizeAdvisorTimezone(value: unknown, fallback = "UTC") {
  const tz = String(value || "").trim() || fallback;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    try {
      Intl.DateTimeFormat("en-US", { timeZone: fallback }).format(new Date());
      return fallback;
    } catch {
      return "UTC";
    }
  }
}

function parsePeriod(raw: unknown): HourPeriod | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { start?: unknown; end?: unknown };
  const start = validHm(row.start, "");
  const end = validHm(row.end, "");
  if (!start || !end) return null;
  return { start, end };
}

function parseDayHours(raw: unknown): DayHours {
  const base = emptyDay();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as { on?: unknown; start?: unknown; end?: unknown; periods?: unknown };
  const start = validHm(row.start, base.start);
  const end = validHm(row.end, base.end);
  const periods: HourPeriod[] = [];
  if (Array.isArray(row.periods)) {
    for (const item of row.periods) {
      const period = parsePeriod(item);
      if (period) periods.push(period);
      if (periods.length >= MAX_DAY_PERIODS) break;
    }
  }
  if (!periods.length) periods.push({ start, end });
  return {
    on: Boolean(row.on),
    start: periods[0]?.start || start,
    end: periods[0]?.end || end,
    periods,
  };
}

export function parseHoursJson(raw: unknown): AdvisorHours {
  const base = emptyAdvisorHours();
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return base;
    try {
      parsed = JSON.parse(t);
    } catch {
      return base;
    }
  }
  if (!parsed || typeof parsed !== "object") return base;
  const rec = parsed as Record<string, unknown>;
  let anyOn = false;
  for (const key of WEEKDAY_KEYS) {
    if (rec[key] == null) continue;
    base[key] = parseDayHours(rec[key]);
    if (base[key].on) anyOn = true;
  }
  const configured =
    rec.configured === true || rec.configured === false ? Boolean(rec.configured) : anyOn;
  base.configured = configured;
  base.timezone = normalizeAdvisorTimezone(rec.timezone, base.timezone);
  return base;
}

export function serializeHoursJson(hours: AdvisorHours | Record<string, unknown>) {
  const parsed = parseHoursJson(hours);
  parsed.configured = true;
  return JSON.stringify(parsed);
}

export function daySchedulePeriods(day: DayHours): HourPeriod[] {
  if (Array.isArray(day.periods) && day.periods.length) return day.periods.slice(0, MAX_DAY_PERIODS);
  return [{ start: validHm(day.start), end: validHm(day.end, "17:00") }];
}

export function minutesInPeriod(minutes: number, period: HourPeriod) {
  const start = hmToMinutes(period.start);
  const end = hmToMinutes(period.end);
  if (end > start) return minutes >= start && minutes < end;
  if (end === start) return false;
  return minutes >= start || minutes < end;
}

export function zonedWeekdayAndMinutes(now: Date | number, timeZone: string) {
  const date = typeof now === "number" ? new Date(now) : now;
  const tz = normalizeAdvisorTimezone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekdayRaw = String(parts.find((p) => p.type === "weekday")?.value || "").slice(0, 3).toLowerCase();
  const hourRaw = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minuteRaw = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const weekday = WEEKDAY_FROM_SHORT[weekdayRaw] || "mon";
  return {
    weekday,
    minutes: Math.min(24 * 60 - 1, Math.max(0, hour * 60 + minuteRaw)),
  };
}

export function isWithinAdvisorSchedule(hours: AdvisorHours | null | undefined, now: Date | number = Date.now()) {
  const schedule = hours ? parseHoursJson(hours) : emptyAdvisorHours();
  if (!schedule.configured) return true;
  const clock = zonedWeekdayAndMinutes(now, schedule.timezone);
  const day = schedule[clock.weekday];
  if (!day?.on) return false;
  return daySchedulePeriods(day).some((period) => minutesInPeriod(clock.minutes, period));
}

export function scheduleEndsLiveReading() {
  return false;
}

export function advisorAcceptsNewLiveRequests(input: {
  online?: boolean;
  away?: boolean;
  hours?: AdvisorHours | null;
  now?: Date | number;
}): { ok: boolean; reason: string } {
  if (!input.online) return { ok: false, reason: "This advisor is offline." };
  if (input.away) return { ok: false, reason: "This advisor is away right now." };
  if (!isWithinAdvisorSchedule(input.hours, input.now)) {
    return { ok: false, reason: "This advisor is outside scheduled hours." };
  }
  return { ok: true, reason: "" };
}

export function customerFloorPresence(input: {
  online?: boolean;
  busy?: boolean;
  away?: boolean;
  hours?: AdvisorHours | null;
  now?: Date | number;
}): { online: boolean; busy: boolean } {
  const busy = Boolean(input.busy);
  const accepts = advisorAcceptsNewLiveRequests({ ...input, now: input.now }).ok;
  return {
    online: accepts || busy,
    busy,
  };
}

export function publicAdvisorPresence(row: {
  online?: unknown;
  busy?: unknown;
  away?: unknown;
  hours_json?: unknown;
  schedule_tz?: unknown;
  hours?: AdvisorHours | null;
  now?: Date | number;
}) {
  const online = Boolean(row.online);
  const busy = Boolean(row.busy);
  const hours = row.hours ? parseHoursJson(row.hours) : parseHoursJson(row.hours_json);
  if (row.schedule_tz) hours.timezone = normalizeAdvisorTimezone(row.schedule_tz, hours.timezone);
  return customerFloorPresence({
    online,
    busy,
    away: Boolean(row.away),
    hours,
    now: row.now,
  });
}

export function addDayPeriod(day: DayHours, period?: HourPeriod): DayHours {
  const periods = daySchedulePeriods(day);
  if (periods.length >= MAX_DAY_PERIODS) return { ...day, periods };
  const next = period || { start: "17:00", end: "21:00" };
  const periodsNext = [...periods, { start: validHm(next.start, "17:00"), end: validHm(next.end, "21:00") }];
  return {
    ...day,
    on: true,
    start: periodsNext[0].start,
    end: periodsNext[0].end,
    periods: periodsNext,
  };
}

export function removeDayPeriod(day: DayHours, index: number): DayHours {
  const periods = daySchedulePeriods(day).filter((_, i) => i !== index);
  const next = periods.length ? periods : [{ start: "09:00", end: "17:00" }];
  return {
    ...day,
    start: next[0].start,
    end: next[0].end,
    periods: next,
  };
}

export function scheduleFormDefaults(hours: AdvisorHours, timezone?: string): AdvisorHours {
  const next = parseHoursJson(hours);
  if (timezone) next.timezone = normalizeAdvisorTimezone(timezone, next.timezone);
  if (next.configured) return next;
  for (const key of ["mon", "tue", "wed", "thu", "fri"] as WeekdayKey[]) {
    next[key] = {
      on: true,
      start: "09:00",
      end: "17:00",
      periods: [{ start: "09:00", end: "17:00" }],
    };
  }
  next.configured = false;
  return next;
}

export function setDayUnavailable(day: DayHours): DayHours {
  return { ...day, on: false };
}
