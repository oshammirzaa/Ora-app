import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptIdentityBytes, encryptIdentityBytes } from "./ora-identity-crypto.ts";

describe("identity file encryption", () => {
  it("round-trips a document and does not store the original bytes", () => {
    process.env.IDENTITY_FILE_KEY = "unit-test-identity-key";
    const plain = Buffer.from([0xff, 0xd8, 0xff, 0x11, 0x22, 0x33, 0x44]);
    const sealed = encryptIdentityBytes(plain);
    assert.notEqual(sealed.body, plain.toString("base64"));
    assert.equal(decryptIdentityBytes(sealed.body, sealed.iv).equals(plain), true);
  });
});
