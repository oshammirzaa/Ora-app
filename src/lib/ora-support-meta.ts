export const SUPPORT_REASONS = [
  { id: "payment", label: "Payment/Coins" },
  { id: "session", label: "Chat or Session Problem" },
  { id: "advisor", label: "Advisor Complaint" },
  { id: "account", label: "Account/Login Problem" },
  { id: "technical", label: "Technical Problem" },
  { id: "refund", label: "Refund Request" },
  { id: "other", label: "Other" },
] as const;

export type SupportReason = (typeof SUPPORT_REASONS)[number]["id"];

export const SUPPORT_STATUSES = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number]["id"];

const REASON_IDS = new Set<string>(SUPPORT_REASONS.map((r) => r.id));
const STATUS_IDS = new Set<string>(SUPPORT_STATUSES.map((s) => s.id));

export function reasonLabel(id: string) {
  return SUPPORT_REASONS.find((r) => r.id === id)?.label ?? "Other";
}

export function statusLabel(id: string) {
  return SUPPORT_STATUSES.find((s) => s.id === id)?.label ?? "Open";
}

export function parseReason(value: unknown): SupportReason {
  const id = String(value ?? "").trim();
  return (REASON_IDS.has(id) ? id : "other") as SupportReason;
}

export function parseStatus(value: unknown): SupportStatus {
  const id = String(value ?? "").trim();
  return (STATUS_IDS.has(id) ? id : "open") as SupportStatus;
}

export function isSupportStatus(value: string) {
  return STATUS_IDS.has(value);
}

export function makeTicketNo(seed = Math.random().toString(36).slice(2, 8)) {
  const raw = seed.toUpperCase().replace(/[^A-Z0-9]/g, "X").padEnd(6, "0").slice(0, 6);
  return `ORA-${raw}`;
}
