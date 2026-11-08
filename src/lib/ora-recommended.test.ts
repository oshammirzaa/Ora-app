import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankEligibleAdvisors } from "./ora-earnings-rank.ts";
import {
  cleanRecommendedDraft,
  publishedRecommendations,
  reorderRecommended,
  unavailableRecommendations,
} from "./ora-recommended.ts";

const approved = new Set(["mira", "rowan", "imani", "soren", "lila", "nova"]);

describe("Today's Top 5 recommendations", () => {
  it("keeps admin positions and rejects duplicates or unapproved advisors", () => {
    const picks = cleanRecommendedDraft(
      [
        { slot: 5, advisorId: "nova" },
        { slot: 1, advisorId: "mira" },
        { slot: 3, advisorId: "imani" },
      ],
      approved,
    );
    assert.deepEqual(picks, [
      { slot: 1, advisorId: "mira" },
      { slot: 3, advisorId: "imani" },
      { slot: 5, advisorId: "nova" },
    ]);
    assert.throws(() => cleanRecommendedDraft([{ slot: 1, advisorId: "mira" }, { slot: 2, advisorId: "mira" }], approved), /once/);
    assert.throws(() => cleanRecommendedDraft([{ slot: 1, advisorId: "paused-one" }], approved), /approved/);
    assert.throws(() => cleanRecommendedDraft([{ slot: 6, advisorId: "mira" }], approved), /1 to 5/);
  });

  it("reorders by drag without using earnings", () => {
    const next = reorderRecommended(
      [
        { slot: 1, advisorId: "mira" },
        { slot: 2, advisorId: "rowan" },
        { slot: 3, advisorId: "imani" },
      ],
      "imani",
      "mira",
    );
    assert.deepEqual(next.map((row) => row.advisorId), ["imani", "mira", "rowan"]);
    const earnings = rankEligibleAdvisors([
      { advisorId: "rowan", cents: 9_000, reachedAt: 1 },
      { advisorId: "mira", cents: 1, reachedAt: 2 },
    ]);
    assert.equal(earnings[0]?.advisorId, "rowan");
    assert.notDeepEqual(next.map((row) => row.advisorId), earnings.map((row) => row.advisorId));
  });

  it("shows published live advisors only, keeps offline ones, and hides suspended", () => {
    const shown = publishedRecommendations(
      [
        { slot: 1, advisorId: "mira" },
        { slot: 2, advisorId: "rowan" },
        { slot: 4, advisorId: "gone" },
      ],
      [
        { id: "mira", status: "live", online: true, name: "Mira" },
        { id: "rowan", status: "live", online: false, name: "Rowan" },
        { id: "gone", status: "suspended", online: false, name: "Gone" },
      ],
    );
    assert.deepEqual(shown.map((row) => row.id), ["mira", "rowan"]);
    assert.equal(shown[1]?.online, false);
    assert.equal(shown.length, 2);
    assert.deepEqual(
      unavailableRecommendations(
        [
          { slot: 1, advisorId: "mira" },
          { slot: 2, advisorId: "gone" },
        ],
        [
          { id: "mira", status: "live", name: "Mira" },
          { id: "gone", status: "suspended", name: "Gone" },
        ],
      ),
      ["Gone"],
    );
  });
});
