import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  makeTicketNo,
  parseReason,
  parseStatus,
  reasonLabel,
  statusLabel,
} from "./ora-support-meta.ts";

describe("support ticket helpers", () => {
  it("assigns a unique-looking ORA ticket number", () => {
    assert.match(makeTicketNo("ab12cd"), /^ORA-[A-Z0-9]{6}$/);
    assert.equal(makeTicketNo("k2m9qx"), "ORA-K2M9QX");
  });

  it("maps customer reasons and ticket statuses", () => {
    assert.equal(parseReason("refund"), "refund");
    assert.equal(parseReason("nope"), "other");
    assert.equal(reasonLabel("advisor"), "Advisor Complaint");
    assert.equal(parseStatus("in_progress"), "in_progress");
    assert.equal(parseStatus("weird"), "open");
    assert.equal(statusLabel("closed"), "Closed");
  });
});
