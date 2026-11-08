import { splitIdentityPayload } from "@/lib/ora-identity";
import { uploadIdentityChunk } from "@/lib/ora-identity-store";

const MAX_BYTES = 10 * 1024 * 1024;

export type IdentityUpload = { mime: "image/jpeg" | "image/png" | "application/pdf"; base64: string };

function fileMime(file: File): IdentityUpload["mime"] {
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (type === "image/jpeg" || type === "image/png" || type === "application/pdf") return type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".pdf")) return "application/pdf";
  throw new Error("Upload a JPG, PNG, or PDF.");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export async function readIdentityFile(file: File): Promise<IdentityUpload> {
  const mime = fileMime(file);
  if (file.size > MAX_BYTES) throw new Error("Each identity file must be 10 MB or smaller.");
  if (file.size < 32) throw new Error("That file looks empty.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ok =
    (mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mime === "image/png" && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (mime === "application/pdf" && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
  if (!ok) throw new Error("That file could not be read as a JPG, PNG, or PDF.");
  return { mime, base64: bytesToBase64(bytes) };
}

export async function uploadIdentityDocuments(
  checkId: string,
  files: { front: IdentityUpload | null; back: IdentityUpload | null; selfie: IdentityUpload | null },
) {
  const queue: Array<["front" | "back" | "selfie", IdentityUpload | null]> = [
    ["front", files.front],
    ["selfie", files.selfie],
    ["back", files.back],
  ];
  for (const [side, file] of queue) {
    if (!file) continue;
    const parts = splitIdentityPayload(file.base64);
    for (let index = 0; index < parts.length; index += 1) {
      await uploadIdentityChunk({
        data: { checkId, side, mime: file.mime, index, total: parts.length, chunk: parts[index] || "" },
      });
    }
  }
}
