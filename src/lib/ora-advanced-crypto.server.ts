import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";

function keyMaterial() {
  const secret =
    process.env["JOURNAL_KEY"] ||
    process.env["BETTER_AUTH_SECRET"] ||
    "ora-preview-journal-key-not-for-production";
  return scryptSync(String(secret), "ora-journal-v1", 32);
}

export function journalKeyIsProductionReady() {
  return Boolean(process.env["JOURNAL_KEY"] || process.env["BETTER_AUTH_SECRET"]);
}

export function sealText(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function openText(sealed: string) {
  const [version, ivRaw, tagRaw, dataRaw] = String(sealed || "").split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new Error("Journal entry could not be opened.");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]);
  return plain.toString("utf8");
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function makeTotpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

function b32Decode(value: string) {
  const clean = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const idx = B32.indexOf(char);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function totpCodes(secret: string, now = Date.now(), step = 30) {
  const key = b32Decode(secret);
  const counter = Math.floor(now / 1000 / step);
  return [counter - 1, counter, counter + 1].map((n) => hotp(key, n));
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const want = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(want)) return false;
  return totpCodes(secret, now).includes(want);
}
