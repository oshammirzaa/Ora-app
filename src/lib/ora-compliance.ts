export const COMPLIANCE_CATEGORIES = [
  { id: "personal_info", label: "Personal Information" },
  { id: "off_platform", label: "Off-Platform Contact" },
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
const PLATFORM = /\b(whatsapp|telegram|signal|instagram|insta|snapchat|snap|facebook|tiktok|discord|wechat|viber)\b/i;
const ASK_CONTACT =
  /\b((message|text|call|dm|add|find|contact|reach|hit)\s+me|find me on|add me on|my\s+(number|cell|phone|handle|username|insta|instagram|snap|snapchat|whatsapp|telegram|signal|tiktok))\b/i;
const NARRATIVE_PLATFORM = /\b(blocked|unfollowed|posted|saw|watched|scrolling|on my feed|my ex)\b/i;
const HANDLE = /(^|\s)@[a-z0-9._]{3,30}\b/i;
const SOCIAL_URL = /\b((?:https?:\/\/)?(?:www\.)?(?:wa\.me|t\.me|instagram\.com|instagr\.am|snapchat\.com|tiktok\.com|facebook\.com|discord\.gg)\/[a-z0-9._-]{2,})\b/i;
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
  const url = SOCIAL_URL.test(body);
  const card = hasCard(body);
  const payment = PAYMENT.test(body) || card;
  const ask = ASK_CONTACT.test(body);
  const platform = PLATFORM.test(body);
  const narrative = NARRATIVE_PLATFORM.test(body) && !ask && !phone && !email && !url && !card && !HANDLE.test(body);
  const handle = HANDLE.test(body) && (platform || ask);

  if (payment && (card || ask || /\b(paypal|venmo|cash\s*app|zelle|bitcoin|routing|iban|bank account|card)\b/i.test(body))) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit("external_payment", risk, 0.93, true, CONTACT_WARNING);
  }
  if ((phone || email || url || handle) && !narrative) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit(platform || url || handle ? "off_platform" : "personal_info", risk, 0.94, true, CONTACT_WARNING);
  }
  if (platform && ask && !narrative) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit("off_platform", risk, 0.9, true, CONTACT_WARNING);
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

  if (OFF_PLATFORM.test(body) && (ask || platform || input.sender === "advisor")) {
    return hit("off_platform", input.sender === "advisor" ? "medium" : "low", 0.7, false, "");
  }

  if (phone && recent && ASK_CONTACT.test(recent)) {
    const risk: ComplianceRisk = input.sender === "advisor" ? "high" : "medium";
    return hit("personal_info", risk, 0.9, true, CONTACT_WARNING);
  }

  return null;
}

export function needsContextReview(body: string) {
  return /\b(insta|instagram|whatsapp|telegram|signal|snap|doctor|medication|medicine|intimate|sex|years old|my number|email|paypal|venmo|meet)\b/i.test(body);
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
  const serious = category === "under_18" || category === "medical" || category === "external_payment" || category === "personal_info" || category === "off_platform" || (category === "sexual" && sender === "advisor");
  const block = Boolean(ai.block) && confidence >= 0.9 && serious;
  const next = hit(category, block ? "high" : risk === "low" ? "medium" : risk, confidence, block, block ? (category === "medical" ? MEDICAL_WARNING : category === "under_18" ? UNDER18_WARNING : CONTACT_WARNING) : "", {
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
