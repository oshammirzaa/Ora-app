/** Pure rules for Ora Membership spiritual tools.
 * Scores, cards, and moon copy are reflective entertainment, not predictions or medical advice.
 * Billing helpers never charge by themselves — callers must hold a transaction. */

export const PREMIUM_NOTE =
  "These reflections are spiritual entertainment. They are not scientific measurements, guaranteed outcomes, or medical advice.";

export const EXTENSION_MINUTES = [3, 5, 10] as const;
export type ExtensionMinutes = (typeof EXTENSION_MINUTES)[number];

export const QUEUE_DEFAULTS = { enabled: true, maxLength: 12, inviteSeconds: 60 };

export const MOODS = [
  "happy",
  "hopeful",
  "confused",
  "heartbroken",
  "anxious",
  "calm",
  "stressed",
  "excited",
] as const;
export type MoodId = (typeof MOODS)[number];

export const AFFIRM_CATEGORIES = [
  "love",
  "confidence",
  "healing",
  "career",
  "motivation",
  "self-worth",
  "growth",
] as const;
export type AffirmCategory = (typeof AFFIRM_CATEGORIES)[number];

export const TIMELINE_KINDS = [
  "meeting",
  "date",
  "beginning",
  "conversation",
  "separation",
  "reconciliation",
  "milestone",
  "reading",
] as const;

export const BADGE_DEFS = [
  { id: "first-connection", name: "First Connection", detail: "Awarded after the first completed reading.", target: 1 },
  { id: "seven-day", name: "Seven-Day Journey", detail: "Awarded after a seven-day check-in streak.", target: 7 },
  { id: "tarot-explorer", name: "Tarot Explorer", detail: "Awarded after seven daily tarot reveals.", target: 7 },
  { id: "moon-explorer", name: "Moon Explorer", detail: "Awarded after viewing the moon calendar on seven different days.", target: 7 },
  { id: "reflection", name: "Reflection Journey", detail: "Awarded after seven private journal entries.", target: 7 },
  { id: "one-year", name: "One-Year Member", detail: "Awarded after one year of account membership.", target: 1 },
] as const;

export type BadgeId = (typeof BADGE_DEFS)[number]["id"];

const SIGNS = [
  "capricorn",
  "aquarius",
  "pisces",
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
] as const;
export type SunSign = (typeof SIGNS)[number];

const SIGN_ELEMENT: Record<SunSign, "earth" | "air" | "water" | "fire"> = {
  capricorn: "earth",
  aquarius: "air",
  pisces: "water",
  aries: "fire",
  taurus: "earth",
  gemini: "air",
  cancer: "water",
  leo: "fire",
  virgo: "earth",
  libra: "air",
  scorpio: "water",
  sagittarius: "fire",
};

const SIGN_MODE: Record<SunSign, "cardinal" | "fixed" | "mutable"> = {
  capricorn: "cardinal",
  aquarius: "fixed",
  pisces: "mutable",
  aries: "cardinal",
  taurus: "fixed",
  gemini: "mutable",
  cancer: "cardinal",
  leo: "fixed",
  virgo: "mutable",
  libra: "cardinal",
  scorpio: "fixed",
  sagittarius: "mutable",
};

const SIGN_BLURB: Record<SunSign, string> = {
  aries: "Aries looks for a direct spark and gets restless when feelings stay unspoken.",
  taurus: "Taurus trusts what is steady, tactile, and repeated.",
  gemini: "Gemini bonds through conversation and needs room to change their mind.",
  cancer: "Cancer remembers the tone of care more than the exact words.",
  leo: "Leo wants warmth that is visible, not only implied.",
  virgo: "Virgo shows love by noticing the small thing that would make the day easier.",
  libra: "Libra listens for fairness and pulls away when the mood turns one-sided.",
  scorpio: "Scorpio goes deep quickly and needs honesty more than reassurance.",
  sagittarius: "Sagittarius wants a bond that still leaves the door open.",
  capricorn: "Capricorn takes commitment seriously and warms slowly.",
  aquarius: "Aquarius cares from a little distance and needs a private inner room.",
  pisces: "Pisces feels the weather between two people before either names it.",
};

export type TarotCard = {
  id: string;
  name: string;
  motif: string;
  meaning: string;
  love: string;
  career: string;
  reflection: string;
  guidance: string;
};

export const TAROT: TarotCard[] = [
  { id: "fool", name: "The Fool", motif: "circle", meaning: "A beginning that is honest because nothing is proved yet.", love: "Leave a little mystery instead of deciding the whole story tonight.", career: "A new approach is allowed to be imperfect on the first step.", reflection: "Where are you pretending you already know the ending?", guidance: "Take one sincere step and let the next one wait." },
  { id: "magician", name: "The Magician", motif: "wand", meaning: "Attention, speech, and action can line up if you choose one focus.", love: "Say the thing you can actually offer, not the thing that sounds larger.", career: "Use the skill you already have before collecting another plan.", reflection: "What tool is already in your hands?", guidance: "Make one clear request." },
  { id: "priestess", name: "The High Priestess", motif: "moon", meaning: "Not every answer wants to be rushed into language.", love: "Quiet can be intimacy. It can also be avoidance. Notice which one this is.", career: "Wait for the fact you do not have yet.", reflection: "What do you know that you have not admitted?", guidance: "Keep the question open until morning." },
  { id: "empress", name: "The Empress", motif: "bloom", meaning: "Care grows where there is time, warmth, and something real to tend.", love: "Affection lands when it is specific.", career: "Nourish the work that is already alive.", reflection: "What have you been starving by calling it unimportant?", guidance: "Offer comfort without disappearing into it." },
  { id: "emperor", name: "The Emperor", motif: "square", meaning: "Structure is kind when it protects what matters.", love: "A boundary can be an act of care.", career: "Name the rule, the hour, and the owner of the task.", reflection: "Where would a little order reduce the drama?", guidance: "Choose a frame and keep it for a week." },
  { id: "hierophant", name: "The Hierophant", motif: "key", meaning: "Tradition is useful when you know why you are keeping it.", love: "Ask which family story you are repeating.", career: "A mentor, a method, or a shared standard can steady you.", reflection: "Which rule still deserves your loyalty?", guidance: "Keep the practice. Release the performance." },
  { id: "lovers", name: "The Lovers", motif: "twin", meaning: "A choice between two true things, not a test you can cheat.", love: "Desire and values both get a vote.", career: "Alignment matters more than applause.", reflection: "What are you choosing by not choosing?", guidance: "Name the value that will decide it." },
  { id: "chariot", name: "The Chariot", motif: "arc", meaning: "Direction after hesitation. The reins are yours.", love: "Momentum without listening becomes pressure.", career: "Move the piece that is actually blocked.", reflection: "Are you driving, or being pulled?", guidance: "Set a direction for today only." },
  { id: "strength", name: "Strength", motif: "heart", meaning: "Strength here is a steady hand, not a louder voice.", love: "Stay with the feeling without making it the other person's job.", career: "Patience will do more than force.", reflection: "Where can you be firm and gentle in the same breath?", guidance: "Lower the volume. Keep the boundary." },
  { id: "hermit", name: "The Hermit", motif: "lantern", meaning: "A true answer sometimes needs fewer voices.", love: "Solitude can clarify a bond. It should not be used as punishment.", career: "Study the work before you announce it.", reflection: "Whose opinion are you borrowing?", guidance: "Take a quiet hour and write what remains." },
  { id: "wheel", name: "Wheel of Fortune", motif: "wheel", meaning: "A turn in circumstance. You still choose your posture inside it.", love: "Timing is shifting. Do not confuse change with a verdict.", career: "A cycle is ending. Save what is worth carrying.", reflection: "What repeats until you treat it differently?", guidance: "Adapt one habit. Leave the rest." },
  { id: "justice", name: "Justice", motif: "scale", meaning: "Cause, consequence, and a fair look at both.", love: "Balance is not scorekeeping. It is honesty about effort.", career: "Put the facts on the table before the story.", reflection: "What would be fair if you were not afraid?", guidance: "Tell the plain version." },
  { id: "hanged", name: "The Hanged One", motif: "suspend", meaning: "A pause that changes the angle of the question.", love: "Stop pulling. See what the bond does without pressure.", career: "The delay has information in it.", reflection: "What if the opposite of your plan were also reasonable?", guidance: "Wait one day before you send it." },
  { id: "death", name: "Death", motif: "gate", meaning: "An ending of a form, not of your life. Something has finished.", love: "Let a role end if you are only performing it.", career: "Close the project that is already over.", reflection: "What are you keeping out of habit?", guidance: "Release one thing with a clean goodbye." },
  { id: "temperance", name: "Temperance", motif: "cup", meaning: "Mixing two truths until neither has to win.", love: "Repair is a series of small adjustments.", career: "Blend pace and quality instead of swinging between them.", reflection: "Where are you all-or-nothing?", guidance: "Change the mixture, not the whole recipe." },
  { id: "devil", name: "The Devil", motif: "chain", meaning: "A bond, habit, or bargain that feels larger than it is.", love: "Chemistry is not the same thing as care.", career: "Notice the obligation you agreed to without meaning to.", reflection: "What would you do if the fear were one size smaller?", guidance: "Name the chain. You do not have to break it all today." },
  { id: "tower", name: "The Tower", motif: "bolt", meaning: "A structure that could not hold the truth comes down.", love: "A shock is not a personality. Wait before you rebuild the story.", career: "The collapse shows what was decorative.", reflection: "What false floor just gave way?", guidance: "Get safe first. Interpret later." },
  { id: "star", name: "The Star", motif: "star", meaning: "A quiet hope after weather. Nothing is promised except a clearer sky.", love: "Tenderness can return without a grand reunion scene.", career: "A sincere direction is enough for this week.", reflection: "What hope is modest enough to trust?", guidance: "Drink water, tell the truth, keep the small light." },
  { id: "moon", name: "The Moon", motif: "crescent", meaning: "The path is real and the shadows are loud. Go slowly.", love: "Do not decide a person from one anxious night.", career: "You are missing a fact. Ask for it.", reflection: "Which fear is wearing a costume?", guidance: "Sleep on it. Check it in daylight." },
  { id: "sun", name: "The Sun", motif: "sun", meaning: "Clarity, warmth, and a simpler kind of joy.", love: "Let yourself be seen without managing the reaction.", career: "Show the work. It can stand in the light.", reflection: "What already went right?", guidance: "Share one honest good thing." },
  { id: "judgement", name: "Judgement", motif: "bell", meaning: "A call to answer as the person you are now, not as you were.", love: "Forgiveness is a decision about the future, not a rewrite of the past.", career: "A second chapter can start without pretending the first was perfect.", reflection: "What are you ready to answer?", guidance: "Reply to the call you keep hearing." },
  { id: "world", name: "The World", motif: "wreath", meaning: "A cycle completes. You get to take the learning with you.", love: "A chapter can close with gratitude and still be finished.", career: "Mark the ending so the next beginning has a floor.", reflection: "What did this season teach that you will not give back?", guidance: "Close the circle. Then rest." },
];

export type OracleCard = {
  id: string;
  name: string;
  theme: string;
  reflection: string;
  love: string;
  career: string;
  affirmation: string;
};

export const ORACLE: OracleCard[] = [
  { id: "lantern", name: "Lantern", theme: "Enough light for the next step", reflection: "You do not need the whole map tonight.", love: "Ask for one clear conversation, not a lifetime verdict.", career: "Finish the piece you can see.", affirmation: "I can walk with the light I actually have." },
  { id: "harbor", name: "Harbor", theme: "A safe return", reflection: "Rest is part of the crossing.", love: "Choose the person who is calm when you arrive.", career: "Protect a little unscheduled time.", affirmation: "I am allowed to come back to myself." },
  { id: "mirror", name: "Mirror", theme: "An honest reflection", reflection: "What you dislike out there may be asking for a kinder look in here.", love: "Notice the need under the complaint.", career: "Feedback is information, not a sentence.", affirmation: "I can see myself without shrinking." },
  { id: "bridge", name: "Bridge", theme: "A meeting in the middle", reflection: "Connection asks both people to walk.", love: "Meet halfway only if halfway is mutual.", career: "A collaboration needs a shared definition of done.", affirmation: "I can reach without abandoning my side." },
  { id: "seed", name: "Seed", theme: "A quiet start", reflection: "Small does not mean unserious.", love: "A new tone can begin with one kinder sentence.", career: "Plant the work before you announce the harvest.", affirmation: "I trust a beginning that is still small." },
  { id: "river", name: "River", theme: "Movement that does not force", reflection: "Some things change because you stop damming them.", love: "Let the conversation move. Do not steer every bend.", career: "Follow the task that already has momentum.", affirmation: "I can move without hardening." },
  { id: "hearth", name: "Hearth", theme: "Warmth that stays", reflection: "Care is proven by return, not by a speech.", love: "Look for consistency more than intensity.", career: "Tend the people who make the work possible.", affirmation: "I deserve warmth that does not disappear." },
  { id: "key", name: "Key", theme: "A door you can open", reflection: "The lock may be a conversation you have avoided.", love: "Honesty opens more than strategy does.", career: "Ask for the access you need.", affirmation: "I can ask for the door to open." },
  { id: "feather", name: "Feather", theme: "A lighter hold", reflection: "Not every thought deserves your whole afternoon.", love: "Release the rehearsal of the argument.", career: "Drop one task that is only there to look busy.", affirmation: "I can set down what is not mine to carry." },
  { id: "crown", name: "Quiet Crown", theme: "Self-respect without spectacle", reflection: "Dignity does not require an audience.", love: "You do not have to earn basic regard.", career: "Take the credit that is already yours.", affirmation: "I can stand in my own regard." },
  { id: "tide", name: "Tide", theme: "What returns", reflection: "A feeling may come back. You get to answer it differently.", love: "Familiar is not the same as right.", career: "A recurring problem wants a new response.", affirmation: "I can meet a returning wave with a new choice." },
  { id: "dawn", name: "Dawn", theme: "A clean hour", reflection: "Morning does not erase the night. It gives you a next sentence.", love: "A repair can start with a simple good morning.", career: "Begin before you feel fully ready.", affirmation: "I can start again without pretending I never struggled." },
];

const AFFIRMATIONS: Record<AffirmCategory, string[]> = {
  love: [
    "I deserve a relationship where care shows up in ordinary actions.",
    "I can ask for clarity without apologizing for needing it.",
    "I will not confuse intensity with safety.",
    "I can love someone and still tell the truth.",
    "Mutual respect is a reasonable thing to want.",
    "I can leave a conversation kinder than I entered it.",
    "I do not have to audition for basic consideration.",
  ],
  confidence: [
    "I can speak at the volume of the truth I actually have.",
    "My pace is allowed to be mine.",
    "I can be new at something and still be serious.",
    "I trust the skill I have practiced.",
    "I do not need every person in the room to agree.",
    "I can take up a fair amount of space.",
    "I will begin before the fear finishes its speech.",
  ],
  healing: [
    "I can rest without calling it failure.",
    "Healing can be quiet and still be real.",
    "I am allowed to go slowly through an old hurt.",
    "I can remember what happened and still have a future.",
    "Softness is not the same as weakness.",
    "I will not rush a tender place just to look finished.",
    "I can ask for help that does not take over my life.",
  ],
  career: [
    "I can do honest work without disappearing into it.",
    "One finished piece is worth more than ten perfect plans.",
    "I can ask a clear question about what is expected.",
    "My worth is not the same thing as my output.",
    "I will protect the hours that make the work good.",
    "I can decline a task that was never mine.",
    "Progress today can be small and still count.",
  ],
  motivation: [
    "I only have to do the next true step.",
    "Starting counts, even when the mood is flat.",
    "I can return to the work without shaming the pause.",
    "A short focused hour is enough for today.",
    "I will move the thing I keep walking past.",
    "Motivation can follow action. I do not have to wait for it.",
    "I can keep a promise I made to myself in a size I can hold.",
  ],
  "self-worth": [
    "I do not have to be impressive to be worthy of care.",
    "My needs are allowed to be ordinary.",
    "I can disappoint someone and still be a good person.",
    "I will not bargain away my dignity for reassurance.",
    "I am allowed to take up room in my own life.",
    "Being loved is not a prize I have to keep re-winning every hour.",
    "I can be proud of a quiet improvement.",
  ],
  growth: [
    "I can change a habit without hating the person who had it.",
    "Growth includes the days that look like nothing.",
    "I will tell the truth a little sooner than I used to.",
    "I can learn from a pattern without living inside it.",
    "A better boundary is a form of growth.",
    "I do not have to become someone else to become steadier.",
    "I can keep what is wise from this season and leave the rest.",
  ],
};

const MOOD_COPY: Record<MoodId, { message: string; exercise: string }> = {
  happy: {
    message: "Something in you is light today. Let it be specific. Name what helped, so you can find it again.",
    exercise: "Write down one moment from today that you would like to repeat, and the condition that made it possible.",
  },
  hopeful: {
    message: "Hope is visiting. You do not have to spend it all at once. Keep it near the next small action.",
    exercise: "Write one hope in a single sentence, then one step that would make it slightly more real.",
  },
  confused: {
    message: "You seem to be carrying some uncertainty today. Give yourself room to understand what you need before an important decision.",
    exercise: "List the facts you know, the guesses you are treating as facts, and one question you can ask.",
  },
  heartbroken: {
    message: "A tender place is open. You do not have to make it productive. Kind company and a slower pace are enough for now.",
    exercise: "Write a few lines to yourself as if you were sitting with a friend who hurts in the same way.",
  },
  anxious: {
    message: "Your mind is scanning for what might go wrong. You can thank it, then return to the next hour rather than the whole future.",
    exercise: "Name five things you can see, then one task that takes less than ten minutes.",
  },
  calm: {
    message: "There is a steadiness here. Use it for one honest conversation or one piece of care you have been postponing.",
    exercise: "From this calmer place, write the sentence you want to remember when the weather changes.",
  },
  stressed: {
    message: "The load is real. Stress is not a personal failure. Reduce one demand before you try to feel differently.",
    exercise: "Cross off or postpone one nonessential task, then drink something and step away from the screen for a few minutes.",
  },
  excited: {
    message: "Energy is up. Aim it at one thing you can finish, so the spark becomes a result instead of a spiral.",
    exercise: "Write the excitement down, then choose the first concrete action and a time you will do it.",
  },
};

const MOON_COPY: Record<string, { theme: string; prompt: string; journal: string; affirmation: string }> = {
  new: {
    theme: "A dark moon and a clean page.",
    prompt: "What do you want to begin without announcing it?",
    journal: "Write one intention in plain language. No audience.",
    affirmation: "I can begin quietly.",
  },
  "waxing-crescent": {
    theme: "The first thin light after a decision.",
    prompt: "Which small effort deserves another day?",
    journal: "Note one action you took and one you will repeat.",
    affirmation: "Small effort still counts.",
  },
  "first-quarter": {
    theme: "Half light, and the friction of follow-through.",
    prompt: "Where is resistance asking for a clearer plan?",
    journal: "Write the obstacle and one adjustment.",
    affirmation: "I can adjust without quitting.",
  },
  "waxing-gibbous": {
    theme: "Almost full. Refine rather than add.",
    prompt: "What can be simpler before it is finished?",
    journal: "Edit one plan down to its necessary parts.",
    affirmation: "I can refine what I have started.",
  },
  full: {
    theme: "The full moon shows what has been growing.",
    prompt: "What is visible now that was hidden two weeks ago?",
    journal: "Describe one truth you can see clearly tonight.",
    affirmation: "I can look at my life in full light.",
  },
  "waning-gibbous": {
    theme: "Gratitude and a little sharing.",
    prompt: "Who helped, and have you said so?",
    journal: "Write a thank-you you may or may not send.",
    affirmation: "I can acknowledge what carried me.",
  },
  "last-quarter": {
    theme: "Release what the cycle cannot use.",
    prompt: "What are you done explaining?",
    journal: "Name one habit, story, or obligation to set down.",
    affirmation: "I can release what is finished.",
  },
  "waning-crescent": {
    theme: "Rest before the next dark moon.",
    prompt: "Where do you need less input?",
    journal: "List what you will not decide until you have slept.",
    affirmation: "Rest is part of the cycle.",
  },
};

export function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clampScore(n: number) {
  return Math.max(42, Math.min(96, Math.round(n)));
}

export function safeTimeZone(input: string) {
  const value = String(input || "").trim().slice(0, 80);
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

export function localDateKey(ms: number, timeZone: string) {
  const zone = safeTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function parseBirth(value: string) {
  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return { year, month, day, iso: text };
}

export function sunSign(month: number, day: number): SunSign {
  const n = month * 100 + day;
  if (n >= 1222 || n <= 119) return "capricorn";
  if (n <= 218) return "aquarius";
  if (n <= 320) return "pisces";
  if (n <= 419) return "aries";
  if (n <= 520) return "taurus";
  if (n <= 620) return "gemini";
  if (n <= 722) return "cancer";
  if (n <= 822) return "leo";
  if (n <= 922) return "virgo";
  if (n <= 1022) return "libra";
  if (n <= 1121) return "scorpio";
  return "sagittarius";
}

function elementPair(a: string, b: string) {
  if (a === b) return "same";
  const friends = (a === "fire" && b === "air") || (a === "air" && b === "fire") || (a === "earth" && b === "water") || (a === "water" && b === "earth");
  return friends ? "friend" : "contrast";
}

export type CompatibilityReport = {
  selfSign: SunSign;
  partnerSign: SunSign;
  overall: number;
  emotional: number;
  communication: number;
  romantic: number;
  longTerm: number;
  strengths: string[];
  challenges: string[];
  suggestion: string;
  selfNote: string;
  partnerNote: string;
};

export function compatibilityReport(input: {
  selfName: string;
  selfBirth: string;
  partnerName: string;
  partnerBirth: string;
}): CompatibilityReport | null {
  const self = parseBirth(input.selfBirth);
  const partner = parseBirth(input.partnerBirth);
  if (!self || !partner) return null;
  const selfSignName = sunSign(self.month, self.day);
  const partnerSignName = sunSign(partner.month, partner.day);
  const pair = elementPair(SIGN_ELEMENT[selfSignName], SIGN_ELEMENT[partnerSignName]);
  const base = pair === "same" ? 84 : pair === "friend" ? 76 : 63;
  const modeBonus = SIGN_MODE[selfSignName] === SIGN_MODE[partnerSignName] ? 4 : 0;
  const jitter = (stableHash(`${input.selfName}|${input.partnerName}|${self.iso}|${partner.iso}`) % 7) - 3;
  const overall = clampScore(base + modeBonus + jitter);
  const water = SIGN_ELEMENT[selfSignName] === "water" || SIGN_ELEMENT[partnerSignName] === "water" ? 4 : 0;
  const air = SIGN_ELEMENT[selfSignName] === "air" || SIGN_ELEMENT[partnerSignName] === "air" ? 5 : 0;
  const earth = SIGN_ELEMENT[selfSignName] === "earth" || SIGN_ELEMENT[partnerSignName] === "earth" ? 4 : 0;
  const fire = SIGN_ELEMENT[selfSignName] === "fire" || SIGN_ELEMENT[partnerSignName] === "fire" ? 3 : 0;
  const emotional = clampScore(overall - 4 + water);
  const communication = clampScore(overall - 2 + air);
  const romantic = clampScore(overall + fire - 1);
  const longTerm = clampScore(overall - 6 + earth + (pair === "contrast" ? -2 : 2));
  const strengths =
    pair === "same"
      ? ["You recognize each other's pace.", "Shared instincts can feel like home."]
      : pair === "friend"
        ? ["Your styles can feed each other.", "Difference here is often useful rather than sharp."]
        : ["You notice what the other person skips.", "The contrast can keep the bond honest."];
  const challenges =
    pair === "same"
      ? ["The same habit can become a blind spot.", "Comfort may delay a needed conversation."]
      : pair === "friend"
        ? ["Ease can hide an unspoken expectation.", "One of you may move before the other is ready."]
        : ["You may argue about pace and privacy.", "What feels like care to one can feel like pressure to the other."];
  return {
    selfSign: selfSignName,
    partnerSign: partnerSignName,
    overall,
    emotional,
    communication,
    romantic,
    longTerm,
    strengths,
    challenges,
    suggestion: "Name one need in a single sentence, then ask what they heard. The score is a mirror, not a verdict.",
    selfNote: SIGN_BLURB[selfSignName],
    partnerNote: SIGN_BLURB[partnerSignName],
  };
}

export function tarotFor(userId: string, localDate: string) {
  const index = stableHash(`${userId}|tarot|${localDate}`) % TAROT.length;
  return TAROT[index]!;
}

export function oracleDeal(userId: string, localDate: string) {
  const start = stableHash(`${userId}|oracle|${localDate}`) % ORACLE.length;
  return [0, 1, 2].map((offset) => ORACLE[(start + offset * 5) % ORACLE.length]!);
}

export function affirmationFor(category: AffirmCategory, userId: string, localDate: string) {
  const list = AFFIRMATIONS[category];
  return list[stableHash(`${userId}|${category}|${localDate}`) % list.length]!;
}

export function moodSupport(mood: string) {
  if (!MOODS.includes(mood as MoodId)) return null;
  return MOOD_COPY[mood as MoodId];
}

const SYNODIC = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

export function moonAgeDays(ms: number) {
  const days = (ms - KNOWN_NEW_MOON) / 86_400_000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}

export type MoonPhaseId =
  | "new"
  | "waxing-crescent"
  | "first-quarter"
  | "waxing-gibbous"
  | "full"
  | "waning-gibbous"
  | "last-quarter"
  | "waning-crescent";

export function moonPhaseId(age: number): MoonPhaseId {
  const a = ((age % SYNODIC) + SYNODIC) % SYNODIC;
  if (a < 1.85) return "new";
  if (a < 5.5) return "waxing-crescent";
  if (a < 9.2) return "first-quarter";
  if (a < 12.9) return "waxing-gibbous";
  if (a < 16.7) return "full";
  if (a < 20.4) return "waning-gibbous";
  if (a < 24.1) return "last-quarter";
  if (a < 27.7) return "waning-crescent";
  return "new";
}

export function moonCopy(phase: MoonPhaseId) {
  return MOON_COPY[phase]!;
}

export function upcomingMoonEvents(fromMs: number, days = 40) {
  const events: { phase: "new" | "full" | "first-quarter" | "last-quarter"; at: string }[] = [];
  let prev = moonPhaseId(moonAgeDays(fromMs));
  for (let i = 1; i <= days * 24; i++) {
    const ms = fromMs + i * 3_600_000;
    const phase = moonPhaseId(moonAgeDays(ms));
    if (phase !== prev && (phase === "new" || phase === "full" || phase === "first-quarter" || phase === "last-quarter")) {
      events.push({ phase, at: new Date(ms).toISOString() });
    }
    prev = phase;
  }
  return events;
}

export function premiumAccess(input: { active: boolean; plan: string; renewsAt?: string }, now = Date.now()) {
  if (!input.active || input.plan !== "membership") return false;
  if (input.renewsAt) {
    const end = Date.parse(input.renewsAt);
    if (Number.isFinite(end) && end <= now) return false;
  }
  return true;
}

export function extensionQuote(minutes: number, rateCoins: number) {
  if (!EXTENSION_MINUTES.includes(minutes as ExtensionMinutes)) return null;
  const rate = Math.floor(Number(rateCoins));
  if (!Number.isFinite(rate) || rate < 1) return null;
  return { minutes, seconds: minutes * 60, coins: minutes * rate, rate };
}

export function extensionRefundCoins(leftoverSeconds: number, rateCoins: number) {
  const seconds = Math.max(0, Math.floor(leftoverSeconds));
  const rate = Math.max(1, Math.floor(rateCoins) || 1);
  return Math.floor((seconds * rate) / 60);
}

export function extensionDecision(input: {
  enabled: boolean;
  member: boolean;
  live: boolean;
  balance: number;
  cost: number;
  duplicate: boolean;
}) {
  if (input.duplicate) return { charge: false as const, reason: "duplicate" };
  if (!input.enabled) return { charge: false as const, reason: "disabled" };
  if (!input.member) return { charge: false as const, reason: "locked" };
  if (!input.live) return { charge: false as const, reason: "ended" };
  if (input.balance < input.cost) return { charge: false as const, reason: "balance" };
  return { charge: true as const, reason: "ok" };
}

export function vaultBodyAllowed(body: string) {
  const text = body.trim();
  if (text.length < 2 || text.length > 2000) return false;
  if (/\b(buy coins|send coins|pay me|venmo|cash ?app|paypal|whatsapp|telegram|wire me)\b/i.test(text)) return false;
  return true;
}

export function queuePosition(createdAts: string[], mine: string) {
  const mineMs = Date.parse(mine);
  return createdAts.filter((iso) => Date.parse(iso) <= mineMs).length;
}

export function offerExpired(expiresAt: string, now = Date.now()) {
  const ms = Date.parse(expiresAt);
  return !Number.isFinite(ms) || ms <= now;
}

export function checkInStreak(dates: string[], today: string) {
  const set = new Set(dates);
  let cursor = today;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    const [y, m, d] = cursor.split("-").map(Number);
    const prev = new Date(Date.UTC(y!, (m || 1) - 1, d || 1));
    prev.setUTCDate(prev.getUTCDate() - 1);
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}

export function badgeSnapshot(input: {
  endedReadings: number;
  checkInStreak: number;
  tarotReveals: number;
  moonDays: number;
  journalEntries: number;
  memberYears: number;
}) {
  const values: Record<BadgeId, number> = {
    "first-connection": input.endedReadings > 0 ? 1 : 0,
    "seven-day": input.checkInStreak,
    "tarot-explorer": input.tarotReveals,
    "moon-explorer": input.moonDays,
    reflection: input.journalEntries,
    "one-year": input.memberYears >= 1 ? 1 : 0,
  };
  return BADGE_DEFS.map((badge) => {
    const value = values[badge.id];
    const earned = value >= badge.target;
    return { ...badge, value, earned, progress: Math.min(badge.target, value) };
  });
}

export function yearsSince(iso: string, now = Date.now()) {
  const start = Date.parse(iso);
  if (!Number.isFinite(start)) return 0;
  return (now - start) / (365.25 * 86_400_000);
}

export function defaultInterests() {
  return ["love"] as AffirmCategory[];
}

export function parseInterests(raw: string): AffirmCategory[] {
  const found = String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is AffirmCategory => AFFIRM_CATEGORIES.includes(part as AffirmCategory));
  return found.length ? found : defaultInterests();
}

export function waitEstimateMinutes(position: number, samples: number[]) {
  if (samples.length < 5 || position < 1) return null;
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  if (!Number.isFinite(avg) || avg <= 0) return null;
  return Math.max(1, Math.round((position * avg) / 60));
}

export function signLabel(sign: SunSign) {
  return sign.slice(0, 1).toUpperCase() + sign.slice(1);
}

export function listAffirmations(category: AffirmCategory) {
  return AFFIRMATIONS[category];
}

export function moodIds() {
  return [...MOODS];
}
