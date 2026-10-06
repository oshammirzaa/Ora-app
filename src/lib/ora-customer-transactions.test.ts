import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LedgerRow, PaymentHistoryRow } from "./ora.ts";
import { customerTransactions, previewRows, visibleCustomerTransactions } from "./ora-customer-transactions.ts";

function payment(id: string, createdAt: string, paidAt = ""): PaymentHistoryRow {
  return { id, coins: 10, amountCents: 1000, currency: "usd", status: "succeeded", provider: "card", createdAt, paidAt };
}

function ledger(id: string, createdAt: string): LedgerRow {
  return { id, kind: "reading", amountCoins: -5, seconds: 0, note: "Reading", createdAt };
}

describe("customer transaction preview", () => {
  it("keeps the latest three purchases on the wallet until See More", () => {
    const rows = ["a", "b", "c", "d"];
    assert.deepEqual(previewRows(rows, false).visible, ["a", "b", "c"]);
    assert.equal(previewRows(rows, false).canToggle, true);
    assert.deepEqual(previewRows(rows, true).visible, rows);
    assert.equal(previewRows(["only"], false).canToggle, false);
  });
  it("shows the only transaction and does not offer See more", () => {
    const rows = customerTransactions([payment("p1", "2026-10-01T00:00:00.000Z")], []);
    const view = visibleCustomerTransactions(rows, false);
    assert.equal(view.visible.length, 1);
    assert.equal(view.canToggle, false);
  });

  it("shows all three and does not offer See more", () => {
    const rows = customerTransactions(
      [payment("p1", "2026-10-03T00:00:00.000Z"), payment("p2", "2026-10-01T00:00:00.000Z")],
      [ledger("l1", "2026-10-02T00:00:00.000Z")],
    );
    const view = visibleCustomerTransactions(rows, false);
    assert.deepEqual(view.visible.map((row) => row.key), ["payment:p1", "ledger:l1", "payment:p2"]);
    assert.equal(view.canToggle, false);
  });

  it("shows the latest three until expanded, then the rest, without dropping history", () => {
    const rows = customerTransactions(
      [payment("p1", "2026-10-01T00:00:00.000Z", "2026-10-04T00:00:00.000Z")],
      [
        ledger("l1", "2026-10-05T00:00:00.000Z"),
        ledger("l2", "2026-10-03T00:00:00.000Z"),
        ledger("l3", "2026-10-02T00:00:00.000Z"),
      ],
    );
    assert.equal(rows.length, 4);
    const collapsed = visibleCustomerTransactions(rows, false);
    assert.deepEqual(collapsed.visible.map((row) => row.key), ["ledger:l1", "payment:p1", "ledger:l2"]);
    assert.equal(collapsed.canToggle, true);
    const expanded = visibleCustomerTransactions(rows, true);
    assert.equal(expanded.visible.length, 4);
    assert.equal(expanded.visible[3]?.key, "ledger:l3");
  });
});
