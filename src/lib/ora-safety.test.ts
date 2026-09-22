import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySimulatedBlock,
  applySimulatedReport,
  canCreateSafetyReport,
  canUnblockSafetyBlock,
  emptySafetyStore,
  nextSafetyReportStatus,
  pairIsBlockedFlags,
  parseSafetyReportReason,
  parseSafetyReportStatus,
  publicSafetyReportView,
  safetyActionTouchesMoney,
  safetyBlockDeletesHistory,
  safetyReportAdminNoteVisibleTo,
  safetyReportVisibleToAdvisor,
  safetyReportVisibleToCustomer,
  simulatedPairBlocked,
  tooManySafetyReports,
} from "./ora-safety.ts";

describe("block report and admin escalation", () => {
  it("blocks a pair from either side without deleting history or touching money", () => {
    let store = emptySafetyStore();
    const blocked = applySimulatedBlock(store, {
      advisorId: "adv_1",
      customerId: "cust_1",
      actor: "advisor",
      blocked: true,
    });
    store = blocked.store;
    assert.equal(simulatedPairBlocked(store, "adv_1", "cust_1"), true);
    assert.equal(simulatedPairBlocked(store, "adv_1", "cust_2"), false);
    assert.equal(safetyBlockDeletesHistory(), false);
    assert.equal(safetyActionTouchesMoney(), false);
    const still = applySimulatedBlock(store, {
      advisorId: "adv_1",
      customerId: "cust_1",
      actor: "customer",
      blocked: true,
    });
    store = still.store;
    const advisorUnblock = applySimulatedBlock(store, {
      advisorId: "adv_1",
      customerId: "cust_1",
      actor: "advisor",
      blocked: false,
    });
    store = advisorUnblock.store;
    assert.equal(simulatedPairBlocked(store, "adv_1", "cust_1"), true);
    const customerUnblock = applySimulatedBlock(store, {
      advisorId: "adv_1",
      customerId: "cust_1",
      actor: "customer",
      blocked: false,
    });
    assert.equal(simulatedPairBlocked(customerUnblock.store, "adv_1", "cust_1"), false);
    assert.equal(canUnblockSafetyBlock({ actorRole: "advisor", createdBy: "customer" }), false);
    assert.equal(canUnblockSafetyBlock({ actorRole: "customer", createdBy: "customer" }), true);
  });

  it("prevents new messages and live requests when either party blocked the pair", () => {
    assert.equal(pairIsBlockedFlags({ advisorBlockedCustomer: true, customerBlockedAdvisor: false }), true);
    assert.equal(pairIsBlockedFlags({ advisorBlockedCustomer: false, customerBlockedAdvisor: true }), true);
    assert.equal(pairIsBlockedFlags({ advisorBlockedCustomer: false, customerBlockedAdvisor: false }), false);
  });

  it("keeps reports private from the reported person and from other advisors", () => {
    let store = emptySafetyStore();
    const created = applySimulatedReport(store, {
      advisorId: "adv_a",
      customerId: "cust_1",
      reporterUserId: "adv_user_a",
      reportedUserId: "cust_1",
      reporterRole: "advisor",
      reason: "harassment",
      body: "private note about this client",
    });
    store = created.store;
    const row = store.reports[0];
    row.adminNote = "internal follow-up";
    assert.equal(safetyReportVisibleToCustomer(), false);
    assert.equal(safetyReportVisibleToAdvisor({ ownerAdvisorId: "adv_a", viewerAdvisorId: "adv_b", reporterRole: "advisor" }), false);
    assert.equal(safetyReportVisibleToAdvisor({ ownerAdvisorId: "adv_a", viewerAdvisorId: "adv_a", reporterRole: "advisor" }), true);
    assert.equal(safetyReportAdminNoteVisibleTo("reported"), false);
    assert.equal(safetyReportAdminNoteVisibleTo("advisor"), false);
    assert.equal(safetyReportAdminNoteVisibleTo("admin"), true);
    assert.equal(publicSafetyReportView(row, "reported"), null);
    assert.equal(publicSafetyReportView(row, "advisor", "adv_b"), null);
    assert.equal(publicSafetyReportView(row, "admin")?.adminNote, "internal follow-up");
    assert.equal(publicSafetyReportView(row, "advisor", "adv_a")?.adminNote, "");
  });

  it("maps report reasons and optional descriptions without requiring money changes", () => {
    assert.equal(parseSafetyReportReason("abuse"), "harassment");
    assert.equal(parseSafetyReportReason("inappropriate"), "inappropriate");
    assert.equal(parseSafetyReportReason("spam"), "spam");
    assert.equal(parseSafetyReportReason("payment"), "payment");
    assert.equal(parseSafetyReportReason("safety"), "suspicious");
    assert.equal(parseSafetyReportReason("other"), "other");
    const created = applySimulatedReport(emptySafetyStore(), {
      advisorId: "adv_1",
      customerId: "cust_1",
      reporterUserId: "cust_1",
      reportedUserId: "adv_user",
      reporterRole: "customer",
      reason: "spam",
      body: "",
      readingId: "read_1",
    });
    assert.equal(created.error, "");
    assert.equal(created.store.reports[0]?.body, "");
    assert.equal(created.store.reports[0]?.readingId, "read_1");
    assert.equal(safetyActionTouchesMoney(), false);
  });

  it("enforces permissions and daily report abuse limits", () => {
    assert.equal(canCreateSafetyReport({ reporterUserId: "a", reportedUserId: "a" }).ok, false);
    assert.equal(tooManySafetyReports(8), true);
    assert.equal(tooManySafetyReports(7), false);
    let store = emptySafetyStore();
    for (let i = 0; i < 8; i++) {
      const next = applySimulatedReport(store, {
        advisorId: "adv_1",
        customerId: "cust_1",
        reporterUserId: "cust_1",
        reportedUserId: "adv_user",
        reporterRole: "customer",
        reason: "other",
      });
      store = next.store;
    }
    const blocked = applySimulatedReport(store, {
      advisorId: "adv_1",
      customerId: "cust_1",
      reporterUserId: "cust_1",
      reportedUserId: "adv_user",
      reporterRole: "customer",
      reason: "other",
    });
    assert.match(blocked.error, /limit/i);
    assert.equal(parseSafetyReportStatus("reviewing"), "reviewing");
    assert.equal(parseSafetyReportStatus("resolved"), "resolved");
  });

  it("keeps admin status changes on an audit-friendly path and never deletes money records", () => {
    assert.equal(nextSafetyReportStatus("open", "reviewing"), "reviewing");
    assert.equal(nextSafetyReportStatus("reviewing", "resolved"), "resolved");
    assert.equal(nextSafetyReportStatus("resolved", "open"), "open");
    assert.equal(safetyActionTouchesMoney(), false);
    assert.equal(safetyBlockDeletesHistory(), false);
    assert.equal(safetyReportVisibleToAdvisor({ ownerAdvisorId: "adv_a", viewerAdvisorId: "adv_a", reporterRole: "customer" }), false);
  });
});
