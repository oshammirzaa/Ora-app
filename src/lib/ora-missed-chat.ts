import { INCOMING_REQUEST_TTL_MS } from "./ora-advisor-desk-stats.ts";

/** Coins removed from available advisor earnings for one ignored live-chat request. */
export const MISSED_CHAT_PENALTY_COINS = 5;

/**
 * No presence heartbeat for this long means the connection is gone.
 * Short blips stay online. This is longer than a hidden-tab timer tick.
 */
export const PRESENCE_OFFLINE_GRACE_MS = 150_000;

export const MISSED_CHAT_KIND = "missed_chat";
export const MISSED_CHAT_REASON = "missed_chat";

export function missedChatPenalty(balance: number, penalty = MISSED_CHAT_PENALTY_COINS) {
  const available = Math.max(0, Math.floor(Number(balance) || 0));
  const full = Math.max(0, Math.floor(Number(penalty) || 0));
  const charged = Math.min(full, available);
  return {
    penalty: full,
    charged,
    unpaid: full - charged,
    nextBalance: available - charged,
  };
}

export function missedChatPenaltyNote(charged: number, unpaid: number, penalty = MISSED_CHAT_PENALTY_COINS) {
  const full = Math.max(0, Math.floor(penalty));
  const taken = Math.max(0, Math.floor(charged));
  const left = Math.max(0, Math.floor(unpaid));
  if (left <= 0) return `Missed chat penalty -${full} coins`;
  if (taken <= 0) return `Missed chat penalty -${full} coins (unpaid)`;
  return `Missed chat penalty -${full} coins (${taken} charged, ${left} unpaid)`;
}

/** Only a still-pending request that outlives the live-request window is a miss. */
export function isMissedLiveRequest(input: { status?: string | null; ageMs: number; ttlMs?: number }) {
  if (String(input.status || "") !== "pending") return false;
  const ttl = input.ttlMs ?? INCOMING_REQUEST_TTL_MS;
  return input.ageMs >= ttl;
}

export function shouldChargeMissedChat(reason: "timeout" | "accept" | "decline" | "cancel" | "disconnect") {
  return reason === "timeout";
}

export function presenceHeartbeatStale(
  lastSeenAt: string | Date | null | undefined,
  now = Date.now(),
  graceMs = PRESENCE_OFFLINE_GRACE_MS,
) {
  if (lastSeenAt == null || lastSeenAt === "") return false;
  const seen = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return false;
  return now - seen > graceMs;
}

/** A dead connection can turn an advisor off. It never turns them back on. */
export function onlineAfterPresenceCheck(input: {
  online: boolean;
  lastSeenAt?: string | Date | null;
  now?: number;
  manualGoOnline?: boolean;
  graceMs?: number;
}) {
  if (input.manualGoOnline) return true;
  if (!input.online) return false;
  if (presenceHeartbeatStale(input.lastSeenAt, input.now ?? Date.now(), input.graceMs)) return false;
  return true;
}
