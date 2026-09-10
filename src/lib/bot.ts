import { PLANS, type PlanId } from "./catalog";
import { formatMoney } from "./utils";

export type BotStep = "chat" | "name" | "contact" | "done";

export type BotMsg = {
  id: string;
  role: "bot" | "user";
  text: string;
  chips?: string[];
  createdAt: number;
};

export const DEFAULT_CHIPS = ["Prices", "Fire Stick setup", "Sports", "Request a login"];

export function welcomeMessage(): Pick<BotMsg, "text" | "chips"> {
  return {
    text: "Hi — I’m Ember’s shop bot. I answer Fire TV questions and take login requests from people who write in. I cannot search TikTok, Facebook, or Instagram, and I will not message anyone who did not start the chat.",
    chips: DEFAULT_CHIPS,
  };
}

function hasPhone(s: string) {
  return /(\+?\d[\d\s()-]{8,}\d)/.test(s);
}
function hasEmail(s: string) {
  return /\b\S+@\S+\.\S+\b/.test(s);
}

export function extractContact(s: string) {
  const phone = s.match(/(\+?\d[\d\s()-]{8,}\d)/)?.[1]?.replace(/\s+/g, " ").trim();
  const email = s.match(/\b\S+@\S+\.\S+\b/)?.[0];
  return phone || email || "";
}

export function looksLikeName(s: string) {
  const t = s.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (hasPhone(t) || hasEmail(t)) return false;
  return /^[\p{L}\s.'-]+$/u.test(t);
}

function prices(currency: "USD" | "PKR") {
  return PLANS.map((p) => {
    const m = currency === "PKR" ? p.pkrMonth : p.usdMonth;
    return `${p.name} ${formatMoney(m, currency)}/mo`;
  }).join(" · ");
}

export type LocalReply = {
  text: string;
  chips?: string[];
  step?: BotStep;
  name?: string;
  contact?: string;
  planId?: PlanId;
  saveLead?: boolean;
  useGrok?: boolean;
};

export function localReply(
  raw: string,
  ctx: { step: BotStep; name?: string; planId?: PlanId; currency: "USD" | "PKR" },
): LocalReply {
  const text = raw.trim();
  const q = text.toLowerCase();

  if (ctx.step === "name") {
    if (looksLikeName(text)) {
      return {
        text: `Thanks, ${text.trim()}. WhatsApp number or email so the desk can send the login? Include country code if it’s a number (e.g. 92300…).`,
        step: "contact",
        name: text.trim(),
      };
    }
    return {
      text: "Just your name is enough for now — then I’ll ask for WhatsApp.",
      step: "name",
    };
  }

  if (ctx.step === "contact") {
    const contact = extractContact(text);
    if (contact) {
      return {
        text: `Got it. ${ctx.name ?? "Your"} request is on the Sales Desk. Someone will send the Ember login. You can keep asking about setup while you wait.`,
        chips: ["Fire Stick setup", "Prices"],
        step: "done",
        contact,
        saveLead: true,
      };
    }
    return {
      text: "I need a WhatsApp number or an email so the desk can reach you.",
      step: "contact",
    };
  }

  if (/(price|plan|cost|rate|kitna|paisa|rs\b|pkr|usd|monthly|fee)/.test(q)) {
    return {
      text: `${prices(ctx.currency)}. Family is the one most households keep. Want me to take a login request?`,
      chips: ["Request a login", "Sports", "Family"],
      planId: "family",
    };
  }

  if (/(setup|stick|fire\s?tv|hdmi|install|laga|kaise)/.test(q)) {
    return {
      text: "Plug the stick into HDMI, join Wi-Fi, open Ember, sign in with the login we send. Four screens. The Setup page walks through it. Same-day activation for most requests.",
      chips: ["Request a login", "Prices"],
    };
  }

  if (/(sport|cricket|football|match|live\s?tv)/.test(q)) {
    return {
      text: `Sports+ is live football and cricket on the big screen — ${formatMoney(ctx.currency === "PKR" ? 8999 : 34.99, ctx.currency)}/mo, four screens, same-day login.`,
      chips: ["Request a login", "Prices"],
      planId: "sports",
    };
  }

  if (/(family|kid|bach|parent|profile)/.test(q)) {
    return {
      text: `Family is three screens and a kids pin — ${formatMoney(ctx.currency === "PKR" ? 5999 : 22.99, ctx.currency)}/mo.`,
      chips: ["Request a login", "Prices"],
      planId: "family",
    };
  }

  if (/(request|login|subscribe|buy|chahiye|order|start|get ember)/.test(q)) {
    return {
      text: "I can put you on the desk. What name should we use?",
      step: "name",
      planId: ctx.planId ?? "family",
    };
  }

  if (/(tiktok|instagram|facebook|scrape|dm everyone|find people|auto.?message)/.test(q)) {
    return {
      text: "I only talk to people who open this chat. Ember cannot scrape TikTok, Facebook, or Instagram, and it will not auto-message strangers. Use Sales desk → Finder to open public search yourself, then add anyone who replies as a lead.",
      chips: DEFAULT_CHIPS,
    };
  }

  if (/(pirate|iptv panel|fully loaded|cracked|free premium)/.test(q)) {
    return {
      text: "Ember is licensed live TV and on-demand only. I cannot help with pirate IPTV or loaded sticks.",
      chips: ["Prices", "Fire Stick setup"],
    };
  }

  if (/^(hi|hello|hey|salam|salaam|as?salam)/.test(q)) {
    return {
      text: "Hello. Prices, Fire Stick setup, sports, or a login request — what do you need?",
      chips: DEFAULT_CHIPS,
    };
  }

  return { useGrok: true, text: "" };
}

export const GROK_SYSTEM = `You are Ember’s shop bot for a licensed live-TV and on-demand app on Fire TV Stick, Android TV, and phones.
Be brief (2–4 sentences). Currency may be PKR or USD.
Plans: Starter, Family (most kept), Sports+. Same-day activation. Setup is plug HDMI → Wi-Fi → open Ember → sign in.
If they want to buy, ask for their name, then WhatsApp or email.
Refuse pirate IPTV, “fully loaded” sticks, scraping TikTok/Facebook/Instagram, and auto-DMs.
Never claim you found people on social networks. Never invent channel line-ups of pay-TV pirates.`;
