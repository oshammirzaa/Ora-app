import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAT_MESSAGE_WORD_ERROR,
  CHAT_MESSAGE_WORD_LIMIT,
  acceptChatDraft,
  chatMessageOverLimit,
  chatMessageWordState,
  countMessageWords,
  parseChatMessageBody,
  wordsOf,
} from "./ora-chat-words.ts";
import { applySimulatedSend, emptySimulatedState, pairAllowance } from "./ora-paid-messages.ts";

describe("countMessageWords", () => {
  it("ignores extra whitespace, line breaks, emoji, and punctuation-only tokens", () => {
    assert.equal(countMessageWords(""), 0);
    assert.equal(countMessageWords("   \n\n  "), 0);
    assert.equal(countMessageWords("hello"), 1);
    assert.equal(countMessageWords("  hello   world  "), 2);
    assert.equal(countMessageWords("hello\n\nworld\tthere"), 3);
    assert.equal(countMessageWords("hello 😊 🌸 world"), 2);
    assert.equal(countMessageWords("😊 🎉 ✨"), 0);
    assert.equal(countMessageWords("!!! … --"), 0);
    assert.equal(countMessageWords("hello!!!"), 1);
    assert.equal(countMessageWords("it's fine"), 2);
    assert.equal(countMessageWords("你好 世界"), 2);
  });
});

describe("300 word chat limit", () => {
  it("allows 299 and 300 word customer or advisor messages", () => {
    const w299 = wordsOf(299);
    const w300 = wordsOf(300);
    assert.equal(countMessageWords(w299), 299);
    assert.equal(countMessageWords(w300), 300);
    assert.equal(parseChatMessageBody(w299), w299);
    assert.equal(parseChatMessageBody(w300), w300);
    assert.equal(chatMessageOverLimit(w300), false);
    assert.equal(chatMessageWordState(w299).label, "299 / 300 words");
    assert.equal(chatMessageWordState(w300).label, "300 / 300 words");
  });

  it("accepts a 299 and 300 word customer message and rejects 301", () => {
    assert.equal(parseChatMessageBody(wordsOf(299, "c")), wordsOf(299, "c"));
    assert.equal(parseChatMessageBody(wordsOf(300, "c")), wordsOf(300, "c"));
    assert.throws(() => parseChatMessageBody(wordsOf(301, "c")), (err: Error) => err.message === CHAT_MESSAGE_WORD_ERROR);
  });

  it("accepts a 299 and 300 word advisor message and rejects 301", () => {
    assert.equal(parseChatMessageBody(wordsOf(299, "a")), wordsOf(299, "a"));
    assert.equal(parseChatMessageBody(wordsOf(300, "a")), wordsOf(300, "a"));
    assert.throws(() => parseChatMessageBody(wordsOf(301, "a")), (err: Error) => err.message === CHAT_MESSAGE_WORD_ERROR);
  });

  it("rejects 301 word customer and advisor messages on the backend", () => {
    const w301 = wordsOf(301);
    assert.equal(countMessageWords(w301), 301);
    assert.equal(chatMessageOverLimit(w301), true);
    assert.throws(() => parseChatMessageBody(w301), (err: Error) => err.message === CHAT_MESSAGE_WORD_ERROR);
    assert.throws(() => parseChatMessageBody(`  ${w301}  `), (err: Error) => err.message === CHAT_MESSAGE_WORD_ERROR);
    assert.equal(CHAT_MESSAGE_WORD_LIMIT, 300);
  });

  it("keeps oversized pasted text instead of trimming it", () => {
    const current = wordsOf(2);
    const pasted = wordsOf(320);
    const kept = acceptChatDraft(current, pasted, "insertFromPaste");
    assert.equal(kept, pasted);
    assert.equal(countMessageWords(kept), 320);
    assert.equal(chatMessageWordState(kept).error, CHAT_MESSAGE_WORD_ERROR);
    assert.throws(() => parseChatMessageBody(kept), (err: Error) => err.message === CHAT_MESSAGE_WORD_ERROR);
  });

  it("does not add a 301st word when typing once the limit is reached", () => {
    const atLimit = wordsOf(300);
    const typed = `${atLimit} extra`;
    assert.equal(acceptChatDraft(atLimit, typed, "insertText"), atLimit);
    assert.equal(countMessageWords(acceptChatDraft(atLimit, typed, "insertText")), 300);
  });

  it("rejects API bypass attempts without consuming a free paid-message slot", () => {
    let state = emptySimulatedState(20);
    const over = wordsOf(301);
    assert.throws(() => parseChatMessageBody(over), (err: Error) => err.message === CHAT_MESSAGE_WORD_ERROR);
    state = applySimulatedSend(state, {
      advisorId: "adv_a",
      requestId: "req_bypass",
      body: over,
    });
    assert.equal(state.lastReject, "words");
    assert.equal(pairAllowance(state, "adv_a").freeUsed, 0);
    assert.equal(state.messages.length, 0);
    assert.equal(state.wallet, 20);
  });
});
