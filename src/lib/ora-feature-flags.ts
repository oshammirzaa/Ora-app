/** Advanced features stay off unless this preview (or an explicit env flag) turns them on.
 * Bracket access so the bundler does not inline these as empty client values.
 * Never use a VITE_ prefix — that would ship the switch to the browser. */

export const ADVANCED_FLAG_KEYS = [
  "security",
  "chatRecovery",
  "supportPlus",
  "smartReplies",
  "onlineAlerts",
  "schedule",
  "journal",
  "performance",
  "rewards",
  "referrals",
  "gifts",
] as const;

export type AdvancedFlag = (typeof ADVANCED_FLAG_KEYS)[number];
export type AdvancedFlags = Record<AdvancedFlag, boolean>;

const FLAG_ENV: Record<AdvancedFlag, string> = {
  security: "ORA_FLAG_SECURITY",
  chatRecovery: "ORA_FLAG_CHAT_RECOVERY",
  supportPlus: "ORA_FLAG_SUPPORT_PLUS",
  smartReplies: "ORA_FLAG_SMART_REPLIES",
  onlineAlerts: "ORA_FLAG_ONLINE_ALERTS",
  schedule: "ORA_FLAG_SCHEDULE",
  journal: "ORA_FLAG_JOURNAL",
  performance: "ORA_FLAG_PERFORMANCE",
  rewards: "ORA_FLAG_REWARDS",
  referrals: "ORA_FLAG_REFERRALS",
  gifts: "ORA_FLAG_GIFTS",
};

function envRaw(name: string) {
  if (typeof process === "undefined") return "";
  return String(process.env[name] ?? "").trim();
}

function envOn(name: string) {
  const value = envRaw(name).toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function envOff(name: string) {
  const value = envRaw(name).toLowerCase();
  return value === "0" || value === "false" || value === "no";
}

/** True only for an isolated preview or an explicit operator override. */
export function advancedPreviewEnabled() {
  return envOn("ORA_ADVANCED_PREVIEW") || envOn("ORA_ADVANCED_FEATURES");
}

export function advancedFlags(): AdvancedFlags {
  const preview = advancedPreviewEnabled();
  const flags = {} as AdvancedFlags;
  for (const key of ADVANCED_FLAG_KEYS) {
    const name = FLAG_ENV[key];
    if (envOff(name)) flags[key] = false;
    else if (envOn(name)) flags[key] = true;
    else flags[key] = preview;
  }
  return flags;
}

export function flagOn(name: AdvancedFlag) {
  return advancedFlags()[name];
}

export function anyAdvancedFlag(flags: AdvancedFlags) {
  return ADVANCED_FLAG_KEYS.some((key) => flags[key]);
}

export function advancedDisabled(name: AdvancedFlag) {
  if (!flagOn(name)) throw new Error("This feature is not enabled.");
}
