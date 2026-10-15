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

export const SUPPORT_PLUS_REASONS = [
  { id: "payment", label: "Payment and Wallet" },
  { id: "session", label: "Reading or Chat Problem" },
  { id: "advisor", label: "Advisor Complaint" },
  { id: "account", label: "Account and Login" },
  { id: "subscription", label: "Subscription" },
  { id: "technical", label: "Technical Issue" },
  { id: "refund", label: "Refund Request" },
  { id: "other", label: "Other" },
] as const;

export const SUPPORT_PLUS_STATUSES = [
  ...SUPPORT_STATUSES,
  { id: "waiting" as const, label: "Waiting for Customer" },
];

const PLUS_REASON_IDS = new Set<string>(SUPPORT_PLUS_REASONS.map((reason) => reason.id));
const PLUS_STATUS_IDS = new Set<string>(SUPPORT_PLUS_STATUSES.map((status) => status.id));

export function parseReasonPlus(value: unknown) {
  const id = String(value ?? "").trim();
  return PLUS_REASON_IDS.has(id) ? id : "other";
}

export function parseStatusPlus(value: unknown) {
  const id = String(value ?? "").trim();
  return PLUS_STATUS_IDS.has(id) ? id : "open";
}

export function reasonLabelPlus(id: string) {
  return SUPPORT_PLUS_REASONS.find((reason) => reason.id === id)?.label ?? reasonLabel(id);
}

export function statusLabelPlus(id: string) {
  if (id === "waiting") return "Waiting for Customer";
  return statusLabel(id);
}

export function isSupportStatusPlus(value: string) {
  return PLUS_STATUS_IDS.has(value);
}

export function makeTicketNo(seed = Math.random().toString(36).slice(2, 8)) {
  const raw = seed.toUpperCase().replace(/[^A-Z0-9]/g, "X").padEnd(6, "0").slice(0, 6);
  return `ORA-${raw}`;
}
