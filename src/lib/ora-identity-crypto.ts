import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function identityKey() {
  const secret =
    process.env.IDENTITY_FILE_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "";
  if (!secret) {
    if (process.env.GROK_PROJECT_ID) throw new Error("Identity storage is not configured.");
    return createHash("sha256").update("ora-preview-identity").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptIdentityBytes(plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", identityKey(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return { iv: iv.toString("base64"), body: body.toString("base64") };
}

export function decryptIdentityBytes(body: string, iv: string) {
  const packed = Buffer.from(body, "base64");
  if (packed.length < 17) throw new Error("Stored identity file is unreadable.");
  const tag = packed.subarray(packed.length - 16);
  const data = packed.subarray(0, packed.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", identityKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function encryptIdentityText(plain: string) {
  return encryptIdentityBytes(Buffer.from(plain, "utf8"));
}

export function decryptIdentityText(body: string, iv: string) {
  return decryptIdentityBytes(body, iv).toString("utf8");
}
