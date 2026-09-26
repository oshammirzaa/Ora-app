export const COMPLIANCE_CATEGORIES = [
  { id: "personal_info", label: "Personal Information" },
  { id: "off_platform", label: "Off-Platform Contact" },
  { id: "OFF_PLATFORM_CONTACT_ATTEMPT", label: "OFF_PLATFORM_CONTACT_ATTEMPT" },
  { id: "advisor_disclosure", label: "Advisor Personal Disclosure" },
  { id: "sexual", label: "Sexual / Explicit Content" },
  { id: "medical", label: "Medical Advice" },
  { id: "under_18", label: "Under 18" },
  { id: "external_payment", label: "External Payment / Contact" },
  { id: "other", label: "Other Safety Concern" },
] as const;

export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number]["id"];
export type ComplianceRisk = "low" | "medium" | "high";
export type ComplianceSender = "customer" | "advisor";
export type AiReportStatus = "new" | "reviewing" | "resolved" | "dismissed";

export const CONTACT_WARNING =
  "For your privacy and safety, please keep communication and personal contact information within Ora.";
export const OFF_PLATFORM_ATTEMPT_WARNING =
  "For your safety, communication with advisors and customers must stay within Ora.";
export const MEDICAL_WARNING = "Ora does not allow medical diagnosis or treatment advice.";
export const UNDER18_WARNING = "Ora readings are only available to users aged 18+.";
export const SEXUAL_ADVISOR_WARNING =
  "Ora advisors must not engage in explicit sexual conversation. Do not continue this topic.";
export const SEXUAL_CUSTOMER_NOTICE =
  "A customer message may be explicit. Do not engage. Keep the reading within Ora's guidelines.";

export type ComplianceHit = {
  category: ComplianceCategory;
  risk: ComplianceRisk;
  confidence: number;
  block: boolean;
  stopReading: boolean;
  warning: string;
  advisorWarning: string;
};

const WORD_DIGIT: Record<string, string> = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const EMAIL = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

/** Add a platform by appending an id, label, and aliases. Detection is built from this list. */
export const SOCIAL_PLATFORMS: ReadonlyArray<{ id: string; label: string; aliases: readonly string[] }> = [
  { id: "messenger", label: "Messenger", aliases: ["messenger", "messenger.com", "m.me"] },
  { id: "facebook", label: "Facebook", aliases: ["facebook", "fb", "facebook.com", "fb.com", "fb.me"] },
  { id: "instagram", label: "Instagram", aliases: ["instagram", "insta", "ig", "instagram.com", "ig.me", "instagr.am"] },
  { id: "tiktok", label: "TikTok", aliases: ["tiktok", "tt", "tiktok.com"] },
  { id: "snapchat", label: "Snapchat", aliases: ["snapchat", "snap", "sc", "snapchat.com"] },
  { id: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "wa", "whatsapp.com", "wa.me"] },
  { id: "telegram", label: "Telegram", aliases: ["telegram", "tg", "t.me", "telegram.me", "telegram.org"] },
  { id: "signal", label: "Signal", aliases: ["signal"] },
  { id: "x", label: "X", aliases: ["twitter", "x.com", "twitter.com"] },
  { id: "discord", label: "Discord", aliases: ["discord", "discord.gg", "discord.com"] },
  { id: "threads", label: "Threads", aliases: ["threads", "threads.net"] },
  { id: "linkedin", label: "LinkedIn", aliases: ["linkedin", "linkedin.com"] },
  { id: "youtube", label: "YouTube", aliases: ["youtube", "youtu.be", "youtube.com"] },
  { id: "wechat", label: "WeChat", aliases: ["wechat", "we chat"] },
  { id: "line", label: "LINE", aliases: ["line.me", "line app"] },
  { id: "viber", label: "Viber", aliases: ["viber"] },
  { id: "kik", label: "Kik", aliases: ["kik", "kik.me"] },
  { id: "skype", label: "Skype", aliases: ["skype"] },
];

const PLATFORM_ALT = SOCIAL_PLATFORMS.flatMap((row) => row.aliases)
  .slice()
  .sort((a, b) => b.length - a.length)
  .map((alias) => alias.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"))
  .join("|");

const SOCIAL_URL = new RegExp(
  `\\b(?:https?:\\/\\/)?(?:www\\.)?(?:${SOCIAL_PLATFORMS.flatMap((row) => row.aliases).filter((alias) => alias.includes(".")).map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\/[^\\s]{1,}`,
  "i",
);
const NARRATIVE_PLATFORM =
  /\b(blocked|unfollowed|posted|posting|saw|watched|watching|scrolling|on my feed|my ex|your ex|his ex|her ex|you said|removed me|kicked me|follows|followed|checks my|checked my|boyfriend|girlfriend)\b/i;
const HANDLE = /(^|\s)@[a-z0-9._]{3,30}\b/i;
const PAYMENT =
  /\b(paypal|venmo|cash\s*app|cashapp|zelle|bitcoin|btc wallet|routing number|bank account|iban|wire me|send (?:me )?money|pay me (?:on|via|through))\b/i;
const OFF_PLATFORM =
  /\b(off (?:the |this )?app|outside (?:of )?ora|not on (?:here|ora|this app)|another (?:app|platform)|somewhere else|talk privately)\b/i;
const ADVISOR_PRIVATE =
  /\b(my (?:personal )?(?:phone|cell)|my (?:home |mailing )?address is|i live at\s+\d|come over to my|my real name is|text me personally|call me after|let'?s meet privately|let us meet privately)\b/i;
const HOME_ADDRESS =
  /\bmy (?:home |mailing )?address(?: is)?\s+\d{1,5}\s+[a-z]|\bi live at\s+\d{1,5}\s+[a-z]/i;
const EXPLICIT =
  /\b(nudes?|horny|sext(?:ing)?|orgasm|blowjob|handjob|porn|dick\s*pic|send nudes|get naked|have sex|fuck me|jerk off|sexual services?|erotic chat)\b/i;
const SAFE_MEDICAL =
  /\b(see|speak with|talk to|consult|ask)\b[^.]{0,48}\b(doctor|physician|medical professional|qualified professional)\b|\bnot a doctor\b|\bnot medical advice\b|\bqualified medical professional\b/i;
const UNSAFE_MEDICAL =
  /\b(you have|you(?:'ve| have) got|this is|i diagnos\w*)\b[^.]{0,48}\b(cancer|depression|diabetes|infection|tumor|tumour|anxiety disorder|pregnant)\b|\b(stop|start|change|increase|decrease|don'?t take|do not take)\b[^.]{0,40}\b(medication|medicine|pills?|dose|prescription)\b|\b(don'?t|do not|skip|no need to)\b[^.]{0,36}\b(see )?(a |the |your )?(doctor|hospital|physician)\b|\b(instead of|replace)\b[^.]{0,36}\b(a |your )?(doctor|medicine|treatment|medication)\b/i;

export function complianceCategoryLabel(id: string) {
  return COMPLIANCE_CATEGORIES.find((row) => row.id === id)?.label || "Other Safety Concern";
}

export function canReadAiReports(isAdmin: boolean) {
  return Boolean(isAdmin);
}

export function accountIsUnder18(dob: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || "").trim());
  if (!match) return false;
  const born = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (!Number.isFinite(born)) return false;
  const cutoff = Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate());
  return born > cutoff;
}

export function shouldBlockCompliance(hit: ComplianceHit | null) {
  if (!hit) return false;
  if (hit.stopReading) return true;
  if (!hit.block || hit.confidence < 0.82) return false;
  return true;
}

function deobfuscate(text: string) {
  return text
    .replace(/\s*\(\s*at\s*\)\s*/gi, "@")
    .replace(/\s*\(\s*dot\s*\)\s*/gi, ".")
    .replace(/\s+\[at\]\s+/gi, "@")
    .replace(/\s+\[dot\]\s+/gi, ".")
    .replace(/\b([a-z0-9._%+-]+)\s+at\s+([a-z0-9.-]+)\s+dot\s+([a-z]{2,})\b/gi, "$1@$2.$3");
}

function wordsToDigits(text: string) {
  return text.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi, (word) => WORD_DIGIT[word.toLowerCase()] || word);
}

function digitClusters(text: string) {
  const glued = text.replace(/(?:\d[\s().\-–]*){6,}\d/g, (chunk) => chunk.replace(/\D/g, ""));
  return glued.split(/[^\d]+/).filter((part) => part.length >= 7 && part.length <= 15);
}

function hasPhone(text: string) {
  const clusters = digitClusters(wordsToDigits(text));
  if (clusters.some((part) => part.length >= 10)) return true;
  if (!clusters.length) return false;
  return /\b(number|phone|cell|call|text|whatsapp)\b/i.test(text);
}

function hasCard(text: string) {
  if (/\b(phone|cell|whatsapp|call me|my number|text me)\b/i.test(text)) return false;
  const compact = text.replace(/(?<=\d)[\s-]+(?=\d)/g, "");
  return /(?:^|\D)\d{15,16}(?:\D|$)/.test(compact);
}

function hasEmail(text: string) {
  return EMAIL.test(deobfuscate(text));
}

const KNOWN_PLATFORM_WORDS = new Set(
  SOCIAL_PLATFORMS.flatMap((row) => row.aliases).flatMap((alias) => alias.split(/[\s.]+/)).filter((part) => part.length >= 5).concat(
    ["facebook", "instagram", "snapchat", "whatsapp", "telegram", "tiktok", "discord", "youtube", "linkedin", "wechat", "twitter", "signal", "messenger", "viber", "skype", "threads"],
  ),
);

const SPLIT_PLATFORM: Array<[RegExp, string]> = [
  [/face[\s._-]+book/g, "facebook"],
  [/whats[\s._-]+app/g, "whatsapp"],
  [/snap[\s._-]+chat/g, "snapchat"],
  [/tik[\s._-]+tok/g, "tiktok"],
  [/insta[\s._-]+gram/g, "instagram"],
  [/tele[\s._-]+gram/g, "telegram"],
  [/you[\s._-]+tube/g, "youtube"],
  [/linked[\s._-]+in/g, "linkedin"],
];

export function normalizeComplianceText(text: string) {
  let next = text.toLowerCase().replace(/[’]/g, "'");
  next = next.replace(/\b(?:[a-z][.\s-]+){4,}[a-z]\b/g, (chunk) => {
    const word = chunk.replace(/[^a-z]/g, "");
    return KNOWN_PLATFORM_WORDS.has(word) ? word : chunk;
  });
  for (const [pattern, word] of SPLIT_PLATFORM) next = next.replace(pattern, word);
  next = next.replace(/\b([a-z0-9]+)\s*(?:\(\s*dot\s*\)|\[dot\]|\bdot\b|\.)\s*([a-z]{2,})\b/g, "$1.$2");
  return next;
}

function aliasHits(text: string, alias: string) {
  const body = alias
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(`(?:^|[^a-z0-9])(?:${body})(?=$|[^a-z0-9])`, "i").test(text);
}

const AMBIGUOUS_ALIAS = new Set(["signal", "threads", "snap", "sc", "ig", "fb", "tt", "wa", "tg", "kik"]);

function mentionsAlias(text: string, alias: string) {
  if (!aliasHits(text, alias)) return false;
  if (alias.includes(".")) return true;
  if (!AMBIGUOUS_ALIAS.has(alias) && !alias.includes(" ")) return true;
  const token = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(
    `\\b(?:your|my|on|via|through|add|message|dm|find|contact|reach)\\s+${token}\\b|\\b${token}\\s+(?:is|me|app)\\b`,
    "i",
  ).test(text);
}

export function matchSocialPlatform(normalized: string, original = "") {
  if (/\b(?:what(?:'s|\s+is)\s+your|(?:give|send|share)\s+me\s+your|my\s+x\s+is|(?:add|message|find|dm|contact)\s+(?:me|you)\s+on|(?:talk|chat|message|continue)\s+on)\s+x\b(?!-)/i.test(normalized) || /\bx\.com\b/i.test(normalized)) {
    return SOCIAL_PLATFORMS.find((row) => row.id === "x") || null;
  }
  if (
    /\bLINE\b/.test(original) ||
    /\bline\.me\b/i.test(normalized) ||
    /\bline\s+app\b/i.test(normalized) ||
    /\b(?:what(?:'s|\s+is)\s+your|(?:give|send|share)\s+me\s+your|my\s+line\s+is|(?:add|message|find|dm|contact)\s+(?:me|you)\s+on|(?:talk|chat|message|continue)\s+on)\s+line\b(?!\s+of\b)/i.test(normalized)
  ) {
    return SOCIAL_PLATFORMS.find((row) => row.id === "line") || null;
  }
  for (const row of SOCIAL_PLATFORMS) {
    if (row.aliases.some((alias) => mentionsAlias(normalized, alias))) return row;
  }
  return null;
}

export function detectedSocialPlatform(body: string) {
  const normalized = normalizeComplianceText(body);
  return matchSocialPlatform(normalized, body)?.label || "";
}

const SOCIAL_ASK = new RegExp(
  [
    `\\b(?:(?:can|could|may)\\s+i\\s+(?:have|get|know|see)|what(?:'s|\\s+is)\\s+your|(?:give|send|share)\\s+me\\s+your)\\s+(?:your\\s+)?(?:${PLATFORM_ALT}|number|phone|cell|mobile|email|contact(?:\\s+details)?)\\b`,
    `\\b(?:can|could|may)\\s+i\\s+(?:add|contact|message|find|reach|dm)\\s+you\\s+(?:on|at|via)\\s+(?:${PLATFORM_ALT})\\b`,
    `\\b(?:add|contact|message|find|reach|dm)\\s+you\\s+(?:on|at|via)\\s+(?:${PLATFORM_ALT})\\b`,
    `\\b(?:can\\s+we|could\\s+we|let's|lets)\\s+(?:talk|chat|message|continue|move|switch)\\s+(?:on|via|through|to|over\\s+to)\\s+(?:${PLATFORM_ALT})\\b`,
    `\\b(?:can\\s+we|could\\s+we|let's|lets)\\s+(?:talk|chat|message|continue)\\s+outside\\b`,
    `\\btalk\\s+outside\\s+(?:of\\s+)?ora\\b`,
    `\\b(?:contact|message|text|dm|reach)\\s+me\\s+outside\\b`,
  ].join("|"),
  "i",
);
const SOCIAL_GIVE = new RegExp(
  [
    `\\bmy\\s+(?:${PLATFORM_ALT}|number|phone|cell|mobile|email)\\s+is\\b`,
    `\\b(?:find|message|text|add|dm|contact|reach|follow)\\s+me\\s+on\\s+(?:${PLATFORM_ALT})\\b`,
    `\\bsearch\\s+(?:for\\s+)?my\\s+name\\s+on\\s+(?:${PLATFORM_ALT})\\b`,
    `\\b(?:whatsapp|telegram|signal|skype|kik|viber|messenger)\\s+me\\b`,
    `\\bemail\\s+me\\s+at\\b`,
    `\\b(?:contact|message|text|dm|reach)\\s+me\\s+outside\\b`,
  ].join("|"),
  "i",
);
const PERSONAL_CONTACT =
  /\b(?:(?:can|could|may)\s+i\s+(?:have|get|know|see)|what(?:'s|\s+is)\s+your|(?:give|send|share)\s+me\s+your)\s+(?:your\s+)?(?:number|phone|cell|mobile|email|contact(?:\s+details)?)\b|\bmy\s+(?:number|phone|cell|mobile|email)\s+is\b|\bemail\s+me\s+at\b/i;

export type SocialExchange = { category: "off_platform" | "personal_info"; platform: string };

export function detectSocialExchange(body: string): SocialExchange | null {
  const original = String(body || "");
  const normalized = normalizeComplianceText(original);
  const platform = matchSocialPlatform(normalized, original);
  const asked = SOCIAL_ASK.test(normalized);
  const gave = SOCIAL_GIVE.test(normalized) || (Boolean(platform) && /\bmessage\s+me\s+there\b/i.test(normalized));
  const extra = Boolean(platform) && (
    (platform?.id === "x" && /\b(?:what(?:'s|\s+is)\s+your|(?:give|send|share)\s+me\s+your|my\s+x\s+is|(?:add|message|find|dm|contact)\s+me\s+on|(?:add|message|find|contact)\s+you\s+on|(?:talk|chat|message|continue)\s+on)\s+x\b(?!-)/i.test(normalized)) ||
    (platform?.id === "line" && /\b(?:what(?:'s|\s+is)\s+your|(?:give|send|share)\s+me\s+your|my\s+line\s+is|(?:add|message|find|dm|contact)\s+me\s+on|(?:add|message|find|contact)\s+you\s+on|(?:talk|chat|message|continue)\s+on)\s+line\b(?!\s+of\b)/i.test(normalized))
  );
  if (!asked && !gave && !extra) return null;
  if (platform) return { category: "off_platform", platform: platform.label };
  if (PERSONAL_CONTACT.test(normalized)) return { category: "personal_info", platform: "" };
  return { category: "off_platform", platform: "Off-platform" };
}

export function isNarrativeSocialMention(body: string) {
  const original = String(body || "");
  const normalized = normalizeComplianceText(original);
  if (detectSocialExchange(original)) return false;
  if (!matchSocialPlatform(normalized, original) && !SOCIAL_URL.test(normalized)) return false;
  return NARRATIVE_PLATFORM.test(normalized);
}

function selfAge(text: string) {
  const lower = text.toLowerCase().replace(/[’]/g, "'");
  if (/\b(?:i\s*(?:am|'m)|i'm|im)\s+(?:under\s*18|a minor)\b/.test(lower)) return true;
  const years = lower.match(/\b(?:i\s*(?:am|'m)|i'm|im)\s+(?:a\s+)?(\d{1,2})\s*[- ]?years?\s*old\b/);
  if (years) {
    const age = Number(years[1]);
    return age >= 10 && age <= 17;
  }
  const numeric = lower.match(/\b(?:i\s*(?:am|'m)|i'm|im|(?:just )?turned)\s+(\d{1,2})\b/);
  if (numeric) {
    const age = Number(numeric[1]);
    return age >= 10 && age <= 17;
  }
  return /\b(?:i\s*(?:am|'m)|i'm|im|(?:just )?turned)\s+(thirteen|fourteen|fifteen|sixteen|seventeen)\b/.test(lower);
}

function hit(
  category: ComplianceCategory,
  risk: ComplianceRisk,
  confidence: number,
  block: boolean,
  warning: string,
  extra: Partial<ComplianceHit> = {},
): ComplianceHit {
  return {
    category,
    risk,
    confidence,
    block,
    stopReading: false,
    warning,
    advisorWarning: "",
    ...extra,
  };
}

function plainContextLine(line: string) {
  return String(line || "").replace(/^(?:customer|advisor|client)\s*:\s*/i, "");
}

const CLEAR_OFF_PLATFORM_ATTEMPT = [
  /\b(?:can|could|may)\s+i\s+(?:get|have|know)\s+your\s+contact\b/,
  /\bhow\s+can\s+i\s+contact\s+you\s+(?:outside|off|not\s+here|not\s+on)\b/,
  /\bhow\s+(?:can|do)\s+i\s+(?:find|reach|message|contact)\s+you\s+outside\b/,
  /\b(?:can|could)\s+we\s+(?:talk|chat|message|continue)\s+somewhere\s+else\b/,
  /\banywhere\s+i\s+can\s+(?:talk|chat|message)\s+(?:to\s+)?you\s+not\s+here\b/,
  /\bwhere\s+can\s+i\s+(?:message|text|reach|contact)\s+you\s+privately\b/,
  /\b(?:can|could)\s+we\s+(?:talk|chat|message)\s+outside\b/,
  /\boutside\s+(?:of\s+)?(?:this|the)\s+(?:app|chat|platform)\b/,
  /\boutside\s+(?:of\s+)?ora\b/,
  /\blet'?s\s+talk\s+outside\b/,
  /\btalk\s+outside\s+(?:of\s+)?(?:this\s+)?(?:app|ora)\b/,
  /\boff(?:\s+|-)app\b/,
  /\bgive\s+me\s+your\s+socials?\b/,
  /\bsend\s+me\s+your\s+(?:username|socials?|contact(?:\s+details)?)\b/,
  /\bwhat(?:'s|\s+is)\s+your\s+username\b/,
  /\b(?:your|my)\s+contact\s+details\b/,
  /\bdo\s+you\s+have\s+(?:an?\s+)?(?:insta|ig|snapchat|snap|sc|facebook|fb|tiktok|tt|telegram|tg|whatsapp|wa|signal|discord)\b/,
  /\bwhats\s+your\s+(?:facebook|fb|insta|ig|snapchat|snap|sc|tiktok|tt|telegram|tg|whatsapp|wa|signal|discord|username)\b/,
  /\b(?:can|could)\s+we\s+meet\b/,
  /\bwhere\s+can\s+i\s+meet\s+you\b/,
  /\bmeet\s+(?:up|me)\s+(?:outside|somewhere|in\s+person)\b/,
];

const ADVISOR_OWN_LOCATION =
  /\bi\s+live\s+(?:in|near)\b|\b(?:i\s*(?:am|'m)|i'm|im)\s+from\b|\bmy\s+city\s+is\b|\bmy\s+address\s+is\b|\byou\s+can\s+meet\s+me\b|\bcome\s+meet\s+me\b|\bfind\s+me\s+in\b|\bi\s+work\s+at\b/;

const OTHER_LOCATION_QUESTION =
  /\bwhere\s+do\s+you\s+live\b|\bwhich\s+city\s+do\s+you\s+live\b|\bwhat\s+city\s+do\s+you\s+live\b|\bwhere\s+are\s+you\s+located\b/;

const CUSTOMER_OWN_LOCATION =
  /\b(?:i\s*(?:am|'m)|i'm|im)\s+(?:from|in|near)\b|\bi\s+live\s+in\b|\bi\s+live\s+near\b|\bmy\s+city\s+is\b/;

function clearOffPlatformAttempt(text: string) {
  if (/\bmaybe\b/.test(text) && /\blater\b/.test(text) && !/\b(?:insta|facebook|snap|tiktok|whatsapp|telegram|discord|socials?|username)\b/.test(text)) {
    return false;
  }
  return CLEAR_OFF_PLATFORM_ATTEMPT.some((pattern) => pattern.test(text));
}

function priorOffPlatformIntent(recent: string[]) {
  return recent.some((line) => clearOffPlatformAttempt(normalizeComplianceText(plainContextLine(line))));
}

function attemptHit(sender: ComplianceSender): ComplianceHit {
  const risk: ComplianceRisk = sender === "advisor" ? "high" : "medium";
  return hit("OFF_PLATFORM_CONTACT_ATTEMPT", risk, 0.92, true, OFF_PLATFORM_ATTEMPT_WARNING);
}

/**
 * Intent to move the conversation, a meeting, or contact off Ora.
 * Does not replace phone, email, URL, or handle rules. Role-aware for location.
 */
export function detectOffPlatformContactAttempt(input: {
  body: string;
  sender: ComplianceSender;
  recent?: string[];
}): ComplianceHit | null {
  const body = String(input.body || "").trim();
  if (!body) return null;
  const normalized = normalizeComplianceText(body);
  const recent = input.recent || [];
  if (isNarrativeSocialMention(body) && !clearOffPlatformAttempt(normalized)) return null;
  if (clearOffPlatformAttempt(normalized)) return attemptHit(input.sender);
  if (input.sender === "advisor" && ADVISOR_OWN_LOCATION.test(normalized)) return attemptHit(input.sender);
  if (OTHER_LOCATION_QUESTION.test(normalized)) {
    if (input.sender === "customer") return attemptHit(input.sender);
    if (priorOffPlatformIntent(recent)) return attemptHit(input.sender);
    return null;
  }
  if (input.sender === "customer" && CUSTOMER_OWN_LOCATION.test(normalized) && !/\b(?:meet|outside|socials?|contact)\b/.test(normalized)) {
    return null;
  }
  if (input.sender === "advisor" && priorOffPlatformIntent(recent) && /\b(?:where do you live|which city|your address|meet)\b/.test(normalized)) {
    return attemptHit(input.sender);
  }
  return null;
}

export function classifyCompliance(input: {
  body: string;
  sender: ComplianceSender;
  recent?: string[];
  accountUnder18?: boolean;
}): ComplianceHit | null {
  const body = String(input.body || "").trim();
  const recent = (input.recent || []).join(" \n ");
  if (input.accountUnder18) {
    return hit("under_18", "high", 0.99, true, UNDER18_WARNING, { stopReading: true });
  }
  if (!body) return null;

  if (selfAge(body)) {
    return hit("under_18", "high", 0.96, true, UNDER18_WARNING, { stopReading: true });
  }

  const phone = hasPhone(body);
  const email = hasEmail(body);
  const normalized = normalizeComplianceText(body);
  const url = SOCIAL_URL.test(body) || SOCIAL_URL.test(normalized);
  const card = hasCard(body);
  const payment = PAYMENT.test(body) || card;
  const exchange = detectSocialExchange(body);
  const narrative = isNarrativeSocialMention(body);
  const platform = matchSocialPlatform(normalized, body);
  const handle = HANDLE.test(body) && Boolean(platform);

  if (payment && (card || exchange || /\b(paypal|venmo|cash\s*app|zelle|bitcoin|routing|iban|bank account|card)\b/i.test(body))) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit("external_payment", risk, 0.93, true, CONTACT_WARNING);
  }
  if (!narrative && !phone && !email && !url && !handle && !platform && clearOffPlatformAttempt(normalized)) {
    return attemptHit(input.sender);
  }
  if (exchange && !narrative) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit(exchange.category, risk, 0.92, true, CONTACT_WARNING);
  }
  if (!narrative && (phone || email || url || handle)) {
    const offPlatform = Boolean(platform) || url || handle;
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit(offPlatform ? "off_platform" : "personal_info", risk, 0.92, true, CONTACT_WARNING);
  }
  if (HOME_ADDRESS.test(body)) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit("personal_info", risk, 0.9, true, CONTACT_WARNING);
  }

  if (EXPLICIT.test(body)) {
    if (input.sender === "advisor") {
      return hit("sexual", "high", 0.9, true, SEXUAL_ADVISOR_WARNING, { advisorWarning: SEXUAL_ADVISOR_WARNING });
    }
    return hit("sexual", "medium", 0.86, false, "", { advisorWarning: SEXUAL_CUSTOMER_NOTICE });
  }

  if (input.sender === "advisor" && UNSAFE_MEDICAL.test(body) && !SAFE_MEDICAL.test(body)) {
    return hit("medical", "high", 0.9, true, MEDICAL_WARNING);
  }

  if (input.sender === "advisor" && ADVISOR_PRIVATE.test(body)) {
    return hit("advisor_disclosure", "high", 0.88, true, CONTACT_WARNING);
  }

  const attempt = detectOffPlatformContactAttempt({ body, sender: input.sender, recent: input.recent });
  if (attempt) return attempt;

  if (OFF_PLATFORM.test(body) && (exchange || platform || input.sender === "advisor")) {
    return hit("off_platform", input.sender === "advisor" ? "medium" : "low", 0.7, false, "");
  }

  if (phone && recent && /\b(number|phone|cell|email|whatsapp|instagram|facebook|snapchat|telegram)\b/i.test(recent)) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit("personal_info", risk, 0.9, true, CONTACT_WARNING);
  }

  return null;
}

export function needsContextReview(body: string) {
  const normalized = normalizeComplianceText(body);
  return (
    Boolean(matchSocialPlatform(normalized, body)) ||
    /\b(doctor|medication|medicine|intimate|sex|years old|my number|email|paypal|venmo|meet|contact|outside)\b/i.test(body)
  );
}

export function applyAiClassification(
  local: ComplianceHit | null,
  ai: { category?: string; risk?: string; confidence?: number; block?: boolean } | null,
  sender: ComplianceSender,
): ComplianceHit | null {
  if (!ai) return local;
  const confidence = Math.max(0, Math.min(1, Number(ai.confidence) || 0));
  const category = COMPLIANCE_CATEGORIES.some((row) => row.id === ai.category)
    ? (ai.category as ComplianceCategory)
    : "other";
  const risk: ComplianceRisk = ai.risk === "high" || ai.risk === "medium" || ai.risk === "low" ? ai.risk : "low";
  if (local && local.confidence >= 0.82) return local;
  if (confidence < 0.8) {
    if (local) return local;
    if (confidence < 0.55) return null;
    return hit(category, "low", confidence, false, "");
  }
  const serious = category === "under_18" || category === "medical" || category === "external_payment" || category === "personal_info" || category === "off_platform" || category === "OFF_PLATFORM_CONTACT_ATTEMPT" || (category === "sexual" && sender === "advisor");
  const block = Boolean(ai.block) && confidence >= 0.9 && serious;
  const warning = !block
    ? ""
    : category === "medical"
      ? MEDICAL_WARNING
      : category === "under_18"
        ? UNDER18_WARNING
        : category === "OFF_PLATFORM_CONTACT_ATTEMPT"
          ? OFF_PLATFORM_ATTEMPT_WARNING
          : CONTACT_WARNING;
  const next = hit(category, block ? "high" : risk === "low" ? "medium" : risk, confidence, block, warning, {
    stopReading: category === "under_18" && confidence >= 0.9,
    advisorWarning: category === "sexual" && sender === "customer" ? SEXUAL_CUSTOMER_NOTICE : "",
  });
  if (local && local.confidence >= next.confidence) return local;
  return next;
}

export type AiReportFilterRow = {
  advisorName: string;
  advisorEmail: string;
  customerName: string;
  category: string;
  risk: string;
  status: string;
  at: string;
};

export function matchesAiReportFilters(
  row: AiReportFilterRow,
  filters: { query?: string; category?: string; risk?: string; status?: string; from?: string; to?: string },
) {
  const query = String(filters.query || "").trim().toLowerCase();
  if (query) {
    const blob = `${row.advisorName} ${row.advisorEmail} ${row.customerName}`.toLowerCase();
    if (!blob.includes(query)) return false;
  }
  if (filters.category && filters.category !== "all" && row.category !== filters.category) return false;
  if (filters.risk && filters.risk !== "all" && row.risk !== filters.risk) return false;
  if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
  const at = Date.parse(row.at);
  if (filters.from && Number.isFinite(at) && at < Date.parse(filters.from)) return false;
  if (filters.to && Number.isFinite(at) && at > Date.parse(`${filters.to}T23:59:59.999Z`)) return false;
  return true;
}
