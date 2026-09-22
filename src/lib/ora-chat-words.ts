export const CHAT_MESSAGE_WORD_LIMIT = 300;
export const CHAT_MESSAGE_WORD_ERROR = "Maximum 300 words per message";
/** Safety ceiling so a 300-word message is never clipped. */
export const CHAT_MESSAGE_CHAR_MAX = 20_000;

const HAS_WORD_CHAR = /\p{L}|\p{N}/u;

export function countMessageWords(text: string) {
  const raw = String(text ?? "");
  if (!raw.trim()) return 0;
  return raw
    .trim()
    .split(/\s+/u)
    .filter((token) => HAS_WORD_CHAR.test(token)).length;
}

export function chatMessageWordState(text: string) {
  const words = countMessageWords(text);
  const over = words > CHAT_MESSAGE_WORD_LIMIT;
  return {
    words,
    limit: CHAT_MESSAGE_WORD_LIMIT,
    over,
    label: `${words} / ${CHAT_MESSAGE_WORD_LIMIT} words`,
    error: over ? CHAT_MESSAGE_WORD_ERROR : "",
  };
}

export function chatMessageOverLimit(text: string) {
  return countMessageWords(text) > CHAT_MESSAGE_WORD_LIMIT;
}

function looksLikePaste(current: string, next: string, inputType?: string) {
  if (inputType === "insertFromPaste" || inputType === "insertFromDrop") return true;
  const added = next.length - current.length;
  const jumped = countMessageWords(next) - countMessageWords(current);
  return added > 12 || jumped > 1;
}

/** Keep oversized pasted text. Block typing past 300 words. Never silent-trim. */
export function acceptChatDraft(current: string, next: string, inputType?: string) {
  const nextWords = countMessageWords(next);
  if (nextWords <= CHAT_MESSAGE_WORD_LIMIT) return next;
  if (countMessageWords(current) > CHAT_MESSAGE_WORD_LIMIT) return next;
  if (looksLikePaste(current, next, inputType)) return next;
  return current;
}

export function chatDraftFromInput(
  current: string,
  event: { target: { value: string }; nativeEvent?: unknown },
) {
  const native = event.nativeEvent;
  const inputType =
    native && typeof native === "object" && "inputType" in native
      ? String((native as { inputType?: string }).inputType || "")
      : "";
  return acceptChatDraft(current, event.target.value, inputType);
}

export function parseChatMessageBody(raw: unknown) {
  const body = String(raw ?? "").trim();
  if (countMessageWords(body) > CHAT_MESSAGE_WORD_LIMIT) {
    throw new Error(CHAT_MESSAGE_WORD_ERROR);
  }
  if (body.length > CHAT_MESSAGE_CHAR_MAX) {
    throw new Error(CHAT_MESSAGE_WORD_ERROR);
  }
  return body;
}

export function wordsOf(count: number, seed = "word") {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return Array.from({ length: n }, (_, i) => `${seed}${i + 1}`).join(" ");
}
