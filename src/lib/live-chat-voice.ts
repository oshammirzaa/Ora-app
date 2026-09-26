export const LIVE_CHAT_VOICE_MS = 60_000;
/** Gentle repeat: inside the 4–5 second window, and longer than the chime so notes never stack. */
export const LIVE_CHAT_VOICE_GAP_MS = 4_500;
export const CRYSTAL_CHIME_MS = 1_600;

export type LiveVoiceState = {
  requestId: string;
  startedAt: number;
};

/** One chime loop at a time. A new id replaces the previous sound instead of stacking it. */
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

type PartialTone = { freq: number; gain: number; decay: number; type: OscillatorType };

/** Soft glass harmonic: warm fifths, short shimmer, no harsh bell partials. */
const CRYSTAL_PARTIALS: PartialTone[] = [
  { freq: 784, gain: 0.05, decay: 1.5, type: "sine" },
  { freq: 1174.66, gain: 0.03, decay: 1.05, type: "sine" },
  { freq: 1568, gain: 0.018, decay: 0.72, type: "sine" },
  { freq: 2349.32, gain: 0.007, decay: 0.38, type: "triangle" },
];

let state: LiveVoiceState | null = null;
let timer = 0;
let notifiedFor = "";
let hideNotifiedFor = "";
let primed = false;
let audio: AudioContext | null = null;
let liveNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

function context() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audio) audio = new AudioCtx();
  return audio;
}

function stopAudioOnly() {
  const batch = liveNodes;
  liveNodes = [];
  for (const node of batch) {
    try {
      const t = node.gain.context.currentTime;
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(0, t);
      node.osc.stop(t);
    } catch {
      /* already stopped */
    }
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

function playCrystalChime() {
  if (!state) return;
  if (Date.now() - state.startedAt >= LIVE_CHAT_VOICE_MS) {
    stopAudioOnly();
    clearTimer();
    return;
  }
  const ctx = context();
  if (!ctx) return;
  if (ctx.state !== "running") {
    void ctx.resume().then(() => {
      if (ctx.state === "running") playCrystalChime();
    }).catch(() => {});
    return;
  }
  if (liveNodes.length) return;
  const now = ctx.currentTime;
  for (const partial of CRYSTAL_PARTIALS) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = partial.type;
    osc.frequency.setValueAtTime(partial.freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(partial.gain, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + partial.decay + 0.02);
    liveNodes.push({ osc, gain });
    osc.onended = () => {
      liveNodes = liveNodes.filter((node) => node.osc !== osc);
    };
  }
}

function ensureLoop() {
  if (timer || typeof window === "undefined") return;
  playCrystalChime();
  timer = window.setInterval(playCrystalChime, LIVE_CHAT_VOICE_GAP_MS);
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
  const ctx = context();
  if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
  if (primed) return;
  primed = true;
  document.addEventListener("visibilitychange", onVisibility);
}

/** Start, continue, or stop the single live-reading chime for the active request. */
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
