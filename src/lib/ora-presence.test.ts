import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeFloor,
  onlineNowCount,
  presenceLabel,
  presenceSortRank,
  presenceState,
} from "./ora-presence.ts";

describe("advisor presence", () => {
  it("maps real online/busy flags without inventing a fourth state", () => {
    assert.equal(presenceState({ online: true, busy: false }), "online");
    assert.equal(presenceState({ online: true, busy: true }), "busy");
    assert.equal(presenceState({ online: false, busy: false }), "offline");
    assert.equal(presenceState({ online: false, busy: true }), "offline");
    assert.equal(presenceState({}), "offline");
  });

  it("labels busy as In Session for customers", () => {
    assert.equal(presenceLabel("online"), "Online");
    assert.equal(presenceLabel("busy"), "In Session");
    assert.equal(presenceLabel("offline"), "Offline");
  });

  it("counts only advisors who are actually online", () => {
    assert.equal(
      onlineNowCount([
        { online: true, busy: false },
        { online: true, busy: true },
        { online: false, busy: false },
      ]),
      2,
    );
    assert.equal(onlineNowCount([]), 0);
    assert.equal(onlineNowCount([{ online: false }]), 0);
  });

  it("sorts available, then in session, then offline", () => {
    assert.equal(presenceSortRank({ online: true, busy: false }), 0);
    assert.equal(presenceSortRank({ online: true, busy: true }), 1);
    assert.equal(presenceSortRank({ online: false, busy: false }), 2);
  });

  it("merges live floor flags onto real advisor rows", () => {
    const cur = [
      { id: "a", name: "Ada", online: false, busy: false },
      { id: "b", name: "Bea", online: true, busy: false },
    ];
    const next = mergeFloor(cur, [
      { id: "a", online: true, busy: false },
      { id: "b", online: true, busy: true },
    ]);
    assert.equal(next[0].online, true);
    assert.equal(next[0].busy, false);
    assert.equal(next[1].busy, true);
    assert.equal(mergeFloor(cur, []), cur);
  });
});
