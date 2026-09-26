export const LIVE_REQUEST_STORAGE_KEY = "ora-live-request";

export type LiveRequestCustomerAction = "back" | "navigate" | "minimize" | "lock" | "cancel" | "accept" | "decline" | "expire";

/** Leaving the screen does not cancel. Only an explicit outcome changes the request. */
export function liveRequestAfterCustomerAction(action: LiveRequestCustomerAction) {
  if (action === "cancel" || action === "expire") return "expired" as const;
  if (action === "accept") return "accepted" as const;
  if (action === "decline") return "declined" as const;
  return "pending" as const;
}

type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function browserStore(): KeyValueStore | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

export function rememberLiveRequest(id: string, storage: KeyValueStore | null = browserStore()) {
  const clean = String(id || "").trim().slice(0, 64);
  if (!clean || !storage) return;
  storage.setItem(LIVE_REQUEST_STORAGE_KEY, clean);
}

export function readLiveRequest(storage: KeyValueStore | null = browserStore()) {
  if (!storage) return "";
  return String(storage.getItem(LIVE_REQUEST_STORAGE_KEY) || "").trim();
}

export function clearLiveRequest(storage: KeyValueStore | null = browserStore()) {
  storage?.removeItem(LIVE_REQUEST_STORAGE_KEY);
}
