export const NOTIFICATION_PREVIEW_COUNT = 5;

export function alertSenderName(alert: { senderName?: string }) {
  const name = String(alert.senderName || "").trim();
  return name || "Ora";
}

export function alertPreviewText(alert: { title?: string; body?: string }) {
  const body = String(alert.body || "").replace(/\s+/g, " ").trim();
  const title = String(alert.title || "").replace(/\s+/g, " ").trim();
  if (body && body !== title) return body;
  return body || title || "Notification";
}

export function alertTimeLabel(iso: string, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const delta = Math.max(0, now - t);
  if (delta < 60_000) return "Now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}d`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function previewNotifications<T>(rows: T[], count = NOTIFICATION_PREVIEW_COUNT) {
  return rows.slice(0, Math.max(0, count));
}

export function alertInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "O") + (parts.length > 1 ? parts[1]?.[0] || "" : "");
  return letters.toUpperCase();
}
