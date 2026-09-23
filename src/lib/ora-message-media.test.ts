import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayChatImage,
  freshIncomingIds,
  insertAtCursor,
  messagePreview,
  sanitizeChatImage,
} from "./ora-message-media.ts";

const jpeg = "data:image/jpeg;base64,aGVsbG8=";

describe("chat media helpers", () => {
  it("inserts an emoji at the cursor without dropping typed text", () => {
    const next = insertAtCursor("Hello world", 5, 5, " ✨");
    assert.equal(next.value, "Hello ✨ world");
    assert.equal(next.cursor, 7);
  });

  it("replaces only the selected range", () => {
    const next = insertAtCursor("Hello world", 6, 11, "Ora");
    assert.equal(next.value, "Hello Ora");
  });

  it("accepts a compressed jpeg and rejects other payloads", () => {
    assert.equal(sanitizeChatImage(jpeg), jpeg);
    assert.equal(sanitizeChatImage(""), "");
    assert.equal(displayChatImage("https://example.com/a.jpg"), "");
    assert.throws(() => sanitizeChatImage("data:image/png;base64,aaaa"), /photo/i);
    assert.throws(() => sanitizeChatImage(`${jpeg}${"a".repeat(130_000)}`), /photo/i);
  });

  it("does not alert for history or your own message", () => {
    const first = freshIncomingIds(null, [
      { id: "a", role: "advisor" },
      { id: "b", role: "customer" },
    ], "customer");
    assert.deepEqual(first.ids, []);
    const own = freshIncomingIds(first.seen, [
      { id: "a", role: "advisor" },
      { id: "b", role: "customer" },
      { id: "c", role: "customer" },
    ], "customer");
    assert.deepEqual(own.ids, []);
    const incoming = freshIncomingIds(own.seen, [
      { id: "a", role: "advisor" },
      { id: "b", role: "customer" },
      { id: "c", role: "customer" },
      { id: "d", role: "advisor" },
    ], "customer");
    assert.deepEqual(incoming.ids, ["d"]);
    const again = freshIncomingIds(incoming.seen, [
      { id: "d", role: "advisor" },
    ], "customer");
    assert.deepEqual(again.ids, []);
  });

  it("labels an image-only message as a photo", () => {
    assert.equal(messagePreview("", jpeg), "Photo");
    assert.equal(messagePreview("Hello", jpeg), "Hello");
    assert.equal(messagePreview("", ""), "");
  });
});
