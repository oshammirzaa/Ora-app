import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCustomOraLogo } from "./ora-brand.ts";

describe("ora brand mark", () => {
  it("treats the built-in moon mark files as the default identity, not a custom upload", () => {
    assert.equal(isCustomOraLogo(""), false);
    assert.equal(isCustomOraLogo("/favicon.svg"), false);
    assert.equal(isCustomOraLogo("/images/ora-logo.png"), false);
    assert.equal(isCustomOraLogo("/images/ora-mark.svg"), false);
    assert.equal(isCustomOraLogo("https://cdn.example/brand.png"), true);
  });
});
