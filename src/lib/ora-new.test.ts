import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newPsychics } from "./ora-new.ts";

describe("newPsychics", () => {
  it("keeps only is_new advisors and sorts newest createdAt first", () => {
    const list = [
      { id: "old-flag", name: "Ada", isNew: true, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "veteran", name: "Bea", isNew: false, createdAt: "2026-09-01T00:00:00.000Z" },
      { id: "fresh", name: "Cal", isNew: true, createdAt: "2026-09-18T00:00:00.000Z" },
    ];
    assert.deepEqual(
      newPsychics(list).map((a) => a.id),
      ["fresh", "old-flag"],
    );
  });

  it("does not label veterans as new", () => {
    const list = [{ id: "v", name: "Val", isNew: false, createdAt: "2026-09-19T00:00:00.000Z" }];
    assert.equal(newPsychics(list).length, 0);
  });
});
