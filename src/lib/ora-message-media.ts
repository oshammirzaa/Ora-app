export const CHAT_IMAGE_MAX_CHARS = 120_000;
const JPEG_PREFIX = "data:image/jpeg;base64,";

export function displayChatImage(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value.startsWith(JPEG_PREFIX) || value.length > CHAT_IMAGE_MAX_CHARS) return "";
  return value;
}

export function sanitizeChatImage(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (!value.startsWith(JPEG_PREFIX) || value.length > CHAT_IMAGE_MAX_CHARS) {
    throw new Error("Use a photo (jpg or png).");
  }
  const payload = value.slice(JPEG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) throw new Error("Use a photo (jpg or png).");
  return value;
}

export function insertAtCursor(value: string, start: number, end: number, text: string) {
  const source = String(value ?? "");
  const from = Math.max(0, Math.min(Number.isFinite(start) ? start : source.length, source.length));
  const to = Math.max(from, Math.min(Number.isFinite(end) ? end : from, source.length));
  const next = source.slice(0, from) + text + source.slice(to);
  return { value: next, cursor: from + text.length };
}

export function messagePreview(body: unknown, image: unknown) {
  const text = String(body ?? "").trim();
  if (text) return text;
  return displayChatImage(image) ? "Photo" : "";
}

export function incomingAlertMessages<T extends { recalled?: boolean }>(messages: T[]) {
  return messages.filter((message) => !message.recalled);
}

export function freshIncomingIds(
  seen: Set<string> | null,
  messages: Array<{ id: string; role: string }>,
  ownRole: string,
) {
  const next = new Set(seen ? [...seen] : []);
  if (!seen) {
    for (const message of messages) next.add(message.id);
    return { seen: next, ids: [] as string[] };
  }
  const ids: string[] = [];
  for (const message of messages) {
    if (!message.id || next.has(message.id)) continue;
    next.add(message.id);
    if (message.role !== ownRole) ids.push(message.id);
  }
  return { seen: next, ids };
}
