import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alertPreviewText,
  alertSenderName,
  alertTimeLabel,
  previewNotifications,
} from "./ora-alert-view.ts";

describe("notification panel copy", () => {
  it("uses the advisor name and a one-line preview", () => {
    assert.equal(alertSenderName({ senderName: " Mira " }), "Mira");
    assert.equal(alertSenderName({ senderName: "" }), "Ora");
    assert.equal(
      alertPreviewText({ title: "Mira sent a follow-up", body: "I kept thinking about the card." }),
      "I kept thinking about the card.",
    );
    assert.equal(alertPreviewText({ title: "Your Daily Tarot Card Is Ready", body: "" }), "Your Daily Tarot Card Is Ready");
  });

  it("shows five rows until the full history is opened", () => {
    const rows = [1, 2, 3, 4, 5, 6, 7];
    assert.deepEqual(previewNotifications(rows), [1, 2, 3, 4, 5]);
    assert.equal(alertTimeLabel("2026-10-16T02:00:00.000Z", Date.parse("2026-10-16T02:00:30.000Z")), "Now");
    assert.equal(alertTimeLabel("2026-10-16T01:00:00.000Z", Date.parse("2026-10-16T02:10:00.000Z")), "1h");
  });
});
