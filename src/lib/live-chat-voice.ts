import { LIVE_CHAT_BELL_DATA_URI } from "./psychic-bell-audio.ts";

export const LIVE_CHAT_VOICE_MS = 60_000;
/** Play the 7s bell once per cycle, with a short pause so clips never stack. */
export const LIVE_CHAT_VOICE_GAP_MS = 8_000;
export const BELL_MS = 7_000;
export const CRYSTAL_CHIME_MS = BELL_MS;
export const LIVE_CHAT_BELL_SRC = LIVE_CHAT_BELL_DATA_URI;

export type LiveVoiceState = {
  requestId: string;
  startedAt: number;
};

/** One bell loop at a time. A new id replaces the previous sound instead of stacking it. */
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
let timer = 0;
let notifiedFor = "";
let hideNotifiedFor = "";
let primed = false;
let player: HTMLAudioElement | null = null;

function stopAudioOnly() {
  if (!player) return;
  try {
    player.pause();
    player.currentTime = 0;
  } catch {
    /* already stopped */
  }
}

function clearTimer() {
  if (!timer) return;
  window.clearInterval(timer);
  timer = 0;
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
    window.setTimeout(() => note.close(), LIVE_CHAT_VOICE_MS);
    if (kind === "start") notifiedFor = state.requestId;
    else hideNotifiedFor = state.requestId;
  } catch {
    /* permission or browser limits */
  }
}

function playBell() {
  if (!state) return;
  if (Date.now() - state.startedAt >= LIVE_CHAT_VOICE_MS) {
    stopAudioOnly();
    clearTimer();
    return;
  }
  if (typeof Audio === "undefined") return;
  if (!player) {
    player = new Audio(LIVE_CHAT_BELL_SRC);
    player.preload = "auto";
  }
  try {
    player.currentTime = 0;
    void player.play().catch(() => {});
  } catch {
    /* autoplay or decode limits */
  }
}

function ensureLoop() {
  if (timer || typeof window === "undefined") return;
  playBell();
  timer = window.setInterval(playBell, LIVE_CHAT_VOICE_GAP_MS);
}

function onVisibility() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "hidden") {
    notifyOnce("hidden");
    return;
  }
  if (!state) return;
  if (Date.now() - state.startedAt >= LIVE_CHAT_VOICE_MS) {
    stopAudioOnly();
    clearTimer();
    return;
  }
  if (!timer) ensureLoop();
}

export function primeLiveChatVoice() {
  if (typeof window === "undefined") return;
  if (typeof Audio !== "undefined" && !player) {
    player = new Audio(LIVE_CHAT_BELL_SRC);
    player.preload = "auto";
  }
  if (primed) return;
  primed = true;
  document.addEventListener("visibilitychange", onVisibility);
}

/** Start, continue, or stop the single live-reading bell for the active request. */
export function syncLiveChatVoice(requestId: string) {
  if (typeof window === "undefined") return;
  primeLiveChatVoice();
  const next = reduceLiveChatVoice(state, requestId, Date.now());
  state = next.state;
  if (next.stopAudio) {
    stopAudioOnly();
    clearTimer();
  }
  if (!state) {
    clearTimer();
    stopAudioOnly();
    notifiedFor = "";
    hideNotifiedFor = "";
    return;
  }
  if (next.notify) notifyOnce("start");
  if (next.speak) ensureLoop();
  else {
    stopAudioOnly();
    clearTimer();
  }
}

export function stopLiveChatVoice() {
  state = null;
  notifiedFor = "";
  hideNotifiedFor = "";
  clearTimer();
  stopAudioOnly();
}
