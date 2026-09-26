export const LIVE_CHAT_VOICE_PHRASE = "Ora Live Chat";
export const LIVE_CHAT_VOICE_MS = 60_000;
export const LIVE_CHAT_VOICE_GAP_MS = 2_400;

export type LiveVoiceState = {
  requestId: string;
  startedAt: number;
};

/** One voice at a time. A new id replaces the previous sound instead of stacking it. */
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

export function pickFemaleVoice(voices: Array<{ name?: string; lang?: string }>) {
  const ranked = voices
    .map((voice) => {
      const blob = `${voice.name || ""} ${voice.lang || ""}`.toLowerCase();
      let score = 0;
      if (blob.startsWith("en") || blob.includes("en-") || blob.includes("english")) score += 2;
      if (/female|woman/.test(blob)) score += 5;
      if (/samantha|victoria|zira|karen|moira|fiona|serena|allison|susan|google uk english female/.test(blob)) score += 4;
      if (/\bmale\b|david|daniel|\balex\b/.test(blob)) score -= 4;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked.find((row) => row.score > 0)?.voice || voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("en")) || null;
}

type SpeechVoice = { name: string; lang: string; voiceURI?: string };

let state: LiveVoiceState | null = null;
let timer = 0;
let notifiedFor = "";
let hideNotifiedFor = "";
let primed = false;

function speech() {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return null;
  return window.speechSynthesis;
}

function stopAudioOnly() {
  const synth = speech();
  try {
    synth?.cancel();
  } catch {
    /* already stopped */
  }
}

function clearTimer() {
  if (!timer) return;
  window.clearInterval(timer);
  timer = 0;
}

function closeNote() {
  /* The notification uses a stable tag, so a later one replaces it. Nothing to revoke. */
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
      silent: false,
    });
    window.setTimeout(() => note.close(), LIVE_CHAT_VOICE_MS);
    if (kind === "start") notifiedFor = state.requestId;
    else hideNotifiedFor = state.requestId;
  } catch {
    /* permission or browser limits */
  }
}

function chooseVoice(): SpeechVoice | null {
  const synth = speech();
  if (!synth) return null;
  const voices = synth.getVoices();
  const picked = pickFemaleVoice(voices);
  return picked ? { name: String(picked.name || ""), lang: String(picked.lang || "en-US") } : null;
}

function speakPhrase() {
  const synth = speech();
  if (!synth || !state) return;
  if (Date.now() - state.startedAt >= LIVE_CHAT_VOICE_MS) {
    stopAudioOnly();
    clearTimer();
    return;
  }
  if (synth.speaking || synth.pending) return;
  try {
    if (synth.paused) synth.resume();
  } catch {
    /* resume is best-effort */
  }
  const utter = new SpeechSynthesisUtterance(LIVE_CHAT_VOICE_PHRASE);
  const voice = chooseVoice();
  const match = voice ? synth.getVoices().find((row) => row.name === voice.name && row.lang === voice.lang) : undefined;
  if (match) utter.voice = match;
  utter.lang = voice?.lang || "en-US";
  utter.rate = 0.92;
  utter.pitch = 1.02;
  utter.volume = 1;
  try {
    synth.speak(utter);
  } catch {
    /* speech can fail without a user gesture or in a frozen tab */
  }
}

function ensureLoop() {
  if (timer || typeof window === "undefined") return;
  speakPhrase();
  timer = window.setInterval(speakPhrase, LIVE_CHAT_VOICE_GAP_MS);
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
  clearTimer();
  ensureLoop();
}

export function primeLiveChatVoice() {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const synth = speech();
  try {
    synth?.getVoices();
    synth?.addEventListener("voiceschanged", () => {
      synth.getVoices();
    });
  } catch {
    /* voice list is optional */
  }
  document.addEventListener("visibilitychange", onVisibility);
}

/** Start, continue, or stop the single live-chat voice for the active request. */
export function syncLiveChatVoice(requestId: string) {
  if (typeof window === "undefined") return;
  primeLiveChatVoice();
  const next = reduceLiveChatVoice(state, requestId, Date.now());
  state = next.state;
  if (next.stopAudio) stopAudioOnly();
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
