export const LIVE_CHAT_VOICE_MS = 60_000;
/** Exact uploaded bell. Served as-is: no gain, pitch, or speed change. */
export const LIVE_CHAT_ALERT_SRC = "/sounds/ora_premium_loud_bell_14s.wav";

export type LiveVoiceState = {
  requestId: string;
  startedAt: number;
};

/** One alert at a time. A new id replaces the previous sound instead of stacking it. */
export function reduceLiveChatVoice(state: LiveVoiceState | null, requestId: string, now: number) {
  const id = String(requestId || "").trim();
  if (!id) return { state: null as LiveVoiceState | null, stopAudio: Boolean(state), speak: false, notify: false };
  if (state && state.requestId === id) {
    return { state, stopAudio: false, speak: now - state.startedAt < LIVE_CHAT_VOICE_MS, notify: false };
  }
  return {
    state: { requestId: id, startedAt: now },
    stopAudio: Boolean(state),
    speak: true,
    notify: true,
  };
}

let state: LiveVoiceState | null = null;
let stopTimer = 0;
let notifiedFor = "";
let hideNotifiedFor = "";
let primed = false;
let unlocked = false;
let clip: HTMLAudioElement | null = null;

function browserWindow() {
  const win = globalThis.window;
  if (!win || typeof win.setTimeout !== "function") return null;
  return win;
}

function player() {
  if (clip) return clip;
  const Ctor = globalThis.Audio;
  if (typeof Ctor !== "function") return null;
  const el = new Ctor(LIVE_CHAT_ALERT_SRC);
  el.loop = true;
  el.preload = "auto";
  clip = el;
  return el;
}

function stopAudioOnly() {
  const win = browserWindow();
  if (win && stopTimer) {
    win.clearTimeout(stopTimer);
    stopTimer = 0;
  }
  const el = clip;
  if (!el) return;
  el.pause();
  try {
    el.currentTime = 0;
  } catch {
    /* not seekable yet */
  }
}

function armDeadline() {
  const win = browserWindow();
  if (!win || !state || stopTimer) return;
  const requestId = state.requestId;
  const startedAt = state.startedAt;
  const remain = Math.max(0, startedAt + LIVE_CHAT_VOICE_MS - Date.now());
  stopTimer = win.setTimeout(() => {
    stopTimer = 0;
    if (!state || state.requestId !== requestId || state.startedAt !== startedAt) return;
    stopAudioOnly();
  }, remain);
}

function startAlert() {
  if (!state) return;
  if (Date.now() - state.startedAt >= LIVE_CHAT_VOICE_MS) {
    stopAudioOnly();
    return;
  }
  const el = player();
  if (!el) return;
  el.loop = true;
  el.muted = false;
  if (el.paused || el.ended) void el.play()?.catch(() => {});
  armDeadline();
}

function unlockFromGesture() {
  const el = player();
  if (!el || unlocked) return;
  unlocked = true;
  const alerting = Boolean(state);
  el.muted = !alerting;
  void el.play()?.then(() => {
    el.muted = false;
    if (!state) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
    }
  }).catch(() => {
    el.muted = false;
    unlocked = false;
  });
}

function notifyOnce(kind: "start" | "hidden") {
  if (!state) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (kind === "start" && notifiedFor === state.requestId) return;
  if (kind === "hidden" && hideNotifiedFor === state.requestId) return;
  try {
    const note = new Notification("Ora Live Chat", {
      body: "A client is requesting a live reading.",
      tag: "ora-live-chat",
      silent: true,
    });
    const win = browserWindow();
    win?.setTimeout(() => note.close(), LIVE_CHAT_VOICE_MS);
    if (kind === "start") notifiedFor = state.requestId;
    else hideNotifiedFor = state.requestId;
  } catch {
    /* permission or browser limits */
  }
}

function onVisibility() {
  const doc = globalThis.document;
  if (!doc) return;
  if (doc.visibilityState === "hidden") {
    notifyOnce("hidden");
    return;
  }
  if (!state) return;
  if (Date.now() - state.startedAt >= LIVE_CHAT_VOICE_MS) {
    stopAudioOnly();
    return;
  }
  startAlert();
}

export function primeLiveChatVoice() {
  const win = browserWindow();
  const doc = globalThis.document;
  if (!win || !doc) return;
  unlockFromGesture();
  if (primed) return;
  primed = true;
  doc.addEventListener("visibilitychange", onVisibility);
}

/** Start, continue, or stop the single live-reading bell for the active request. */
export function syncLiveChatVoice(requestId: string) {
  if (!browserWindow()) return;
  const next = reduceLiveChatVoice(state, requestId, Date.now());
  state = next.state;
  if (next.stopAudio) stopAudioOnly();
  if (!state) {
    stopAudioOnly();
    notifiedFor = "";
    hideNotifiedFor = "";
    return;
  }
  primeLiveChatVoice();
  if (next.notify) notifyOnce("start");
  if (next.speak) startAlert();
  else stopAudioOnly();
}

export function stopLiveChatVoice() {
  state = null;
  notifiedFor = "";
  hideNotifiedFor = "";
  stopAudioOnly();
}
