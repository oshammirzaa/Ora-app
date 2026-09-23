let ctx: AudioContext | null = null;
let lastPlayed = 0;

export function unlockMessageSound() {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
}

export function playMessageSound() {
  if (!ctx || ctx.state !== "running") return;
  const nowMs = Date.now();
  if (nowMs - lastPlayed < 900) return;
  lastPlayed = nowMs;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(784, now);
  osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function notifyNewMessage(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const note = new Notification(title, { body: body.slice(0, 140), tag: "ora-message", silent: true });
    window.setTimeout(() => note.close(), 5000);
  } catch {
    /* permission or browser limits */
  }
}

export function askMessageNotificationPermission() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  void Notification.requestPermission().catch(() => {});
}
