export const SAFETY_REPORT_REASONS = [
  { id: "harassment", label: "Harassment" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "spam", label: "Spam" },
  { id: "payment", label: "Payment issue" },
  { id: "suspicious", label: "Suspicious activity" },
  { id: "other", label: "Other" },
] as const;

export type SafetyReportReason = (typeof SAFETY_REPORT_REASONS)[number]["id"];
export type SafetyReportKind = "report" | "escalate";
export type SafetyReportStatus = "open" | "reviewing" | "resolved";
export type SafetyReporterRole = "advisor" | "customer";

export const SAFETY_REPORT_STATUSES: Array<{ id: SafetyReportStatus; label: string }> = [
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Reviewing" },
  { id: "resolved", label: "Resolved" },
];

export const DAILY_SAFETY_REPORT_LIMIT = 8;
export const SAFETY_REPORT_NOTE_MAX = 2000;

const REASON_ALIASES: Record<string, SafetyReportReason> = {
  abuse: "harassment",
  harassment: "harassment",
  inappropriate: "inappropriate",
  spam: "spam",
  scam: "spam",
  payment: "payment",
  safety: "suspicious",
  suspicious: "suspicious",
  other: "other",
};

export function parseSafetyReportReason(value: unknown): SafetyReportReason {
  const id = String(value || "").trim().toLowerCase();
  return REASON_ALIASES[id] || "other";
}

export function parseSafetyReportKind(value: unknown): SafetyReportKind {
  return String(value || "") === "escalate" ? "escalate" : "report";
}

export function parseSafetyReportStatus(value: unknown): SafetyReportStatus {
  const id = String(value || "").trim().toLowerCase();
  if (id === "reviewing" || id === "resolved") return id;
  return "open";
}

export function safetyReportReasonLabel(value: unknown) {
  const id = parseSafetyReportReason(value);
  return SAFETY_REPORT_REASONS.find((r) => r.id === id)?.label || "Other";
}

export function safetyReportStatusLabel(value: unknown) {
  const id = parseSafetyReportStatus(value);
  return SAFETY_REPORT_STATUSES.find((s) => s.id === id)?.label || "Open";
}

export function pairIsBlockedFlags(input: { advisorBlockedCustomer?: boolean; customerBlockedAdvisor?: boolean }) {
  return Boolean(input.advisorBlockedCustomer || input.customerBlockedAdvisor);
}

export function canUnblockSafetyBlock(input: { actorRole: SafetyReporterRole; createdBy: SafetyReporterRole }) {
  return input.actorRole === input.createdBy;
}

export function safetyReportVisibleToAdvisor(input: {
  ownerAdvisorId?: string;
  viewerAdvisorId?: string;
  reporterRole?: string;
}) {
  if (String(input.reporterRole || "") === "customer") return false;
  const owner = String(input.ownerAdvisorId || "").trim();
  const viewer = String(input.viewerAdvisorId || "").trim();
  return Boolean(owner) && owner === viewer;
}

export function safetyReportVisibleToCustomer() {
  return false;
}

export function safetyReportAdminNoteVisibleTo(role: "admin" | "advisor" | "customer" | "reported") {
  return role === "admin";
}

export function tooManySafetyReports(count: number, limit = DAILY_SAFETY_REPORT_LIMIT) {
  return Number(count) >= limit;
}

export function canCreateSafetyReport(input: {
  reporterUserId?: string;
  reportedUserId?: string;
  reportsToday?: number;
}) {
  const reporter = String(input.reporterUserId || "").trim();
  const reported = String(input.reportedUserId || "").trim();
  if (!reporter || !reported) return { ok: false, reason: "Choose who to report." };
  if (reporter === reported) return { ok: false, reason: "You cannot report your own account." };
  if (tooManySafetyReports(Number(input.reportsToday) || 0)) {
    return { ok: false, reason: "You have reached today's report limit." };
  }
  return { ok: true, reason: "" };
}

export function safetyActionTouchesMoney() {
  return false;
}

export function safetyBlockDeletesHistory() {
  return false;
}

export function nextSafetyReportStatus(current: unknown, next: unknown): SafetyReportStatus | null {
  const from = parseSafetyReportStatus(current);
  const to = parseSafetyReportStatus(next);
  if (from === to) return to;
  if (from === "open" && (to === "reviewing" || to === "resolved")) return to;
  if (from === "reviewing" && (to === "open" || to === "resolved")) return to;
  if (from === "resolved" && (to === "open" || to === "reviewing")) return to;
  return to;
}

export type SimulatedSafetyStore = {
  advisorBlocks: Array<{ advisorId: string; customerId: string }>;
  customerBlocks: Array<{ advisorId: string; customerId: string }>;
  reports: Array<{
    id: string;
    advisorId: string;
    customerId: string;
    reporterUserId: string;
    reportedUserId: string;
    reporterRole: SafetyReporterRole;
    reason: SafetyReportReason;
    body: string;
    adminNote: string;
    status: SafetyReportStatus;
    readingId: string;
  }>;
  reportsToday: Record<string, number>;
};

export function emptySafetyStore(): SimulatedSafetyStore {
  return { advisorBlocks: [], customerBlocks: [], reports: [], reportsToday: {} };
}

export function applySimulatedBlock(
  store: SimulatedSafetyStore,
  input: { advisorId: string; customerId: string; actor: SafetyReporterRole; blocked: boolean },
) {
  if (!input.advisorId || !input.customerId || input.advisorId === input.customerId) {
    return { store, error: "invalid", blocked: false };
  }
  const key = { advisorId: input.advisorId, customerId: input.customerId };
  if (input.actor === "advisor") {
    const exists = store.advisorBlocks.some((row) => row.advisorId === key.advisorId && row.customerId === key.customerId);
    const advisorBlocks = input.blocked
      ? exists
        ? store.advisorBlocks
        : [...store.advisorBlocks, key]
      : store.advisorBlocks.filter((row) => !(row.advisorId === key.advisorId && row.customerId === key.customerId));
    return { store: { ...store, advisorBlocks }, error: "", blocked: input.blocked };
  }
  const exists = store.customerBlocks.some((row) => row.advisorId === key.advisorId && row.customerId === key.customerId);
  const customerBlocks = input.blocked
    ? exists
      ? store.customerBlocks
      : [...store.customerBlocks, key]
    : store.customerBlocks.filter((row) => !(row.advisorId === key.advisorId && row.customerId === key.customerId));
  return { store: { ...store, customerBlocks }, error: "", blocked: input.blocked };
}

export function simulatedPairBlocked(store: SimulatedSafetyStore, advisorId: string, customerId: string) {
  return pairIsBlockedFlags({
    advisorBlockedCustomer: store.advisorBlocks.some((row) => row.advisorId === advisorId && row.customerId === customerId),
    customerBlockedAdvisor: store.customerBlocks.some((row) => row.advisorId === advisorId && row.customerId === customerId),
  });
}

export function applySimulatedReport(
  store: SimulatedSafetyStore,
  input: {
    advisorId: string;
    customerId: string;
    reporterUserId: string;
    reportedUserId: string;
    reporterRole: SafetyReporterRole;
    reason?: string;
    body?: string;
    readingId?: string;
  },
) {
  const allowed = canCreateSafetyReport({
    reporterUserId: input.reporterUserId,
    reportedUserId: input.reportedUserId,
    reportsToday: store.reportsToday[input.reporterUserId] || 0,
  });
  if (!allowed.ok) return { store, error: allowed.reason, id: "" };
  const id = `rpt_${store.reports.length + 1}`;
  const row = {
    id,
    advisorId: input.advisorId,
    customerId: input.customerId,
    reporterUserId: input.reporterUserId,
    reportedUserId: input.reportedUserId,
    reporterRole: input.reporterRole,
    reason: parseSafetyReportReason(input.reason),
    body: String(input.body || "").slice(0, SAFETY_REPORT_NOTE_MAX),
    adminNote: "",
    status: "open" as const,
    readingId: String(input.readingId || ""),
  };
  return {
    store: {
      ...store,
      reports: [...store.reports, row],
      reportsToday: {
        ...store.reportsToday,
        [input.reporterUserId]: (store.reportsToday[input.reporterUserId] || 0) + 1,
      },
    },
    error: "",
    id,
  };
}

export function publicSafetyReportView(
  row: SimulatedSafetyStore["reports"][number],
  viewer: "admin" | "advisor" | "customer" | "reported",
  viewerAdvisorId = "",
) {
  const advisorOk = safetyReportVisibleToAdvisor({
    ownerAdvisorId: row.advisorId,
    viewerAdvisorId,
    reporterRole: row.reporterRole,
  });
  if (viewer === "admin") {
    return {
      id: row.id,
      reason: row.reason,
      body: row.body,
      adminNote: row.adminNote,
      status: row.status,
    };
  }
  if (viewer === "advisor" && advisorOk) {
    return { id: row.id, reason: row.reason, body: row.body, adminNote: "", status: row.status };
  }
  return null;
}
