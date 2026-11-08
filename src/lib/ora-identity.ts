/** Manual government-ID review. This does not call an identity-verification vendor. */

import { isCountryName } from "./ora-countries.ts";

export const ID_TYPES = ["passport", "national_id", "driving_licence"] as const;
export type IdType = (typeof ID_TYPES)[number];
export const ID_STATUSES = ["pending", "verified", "rejected"] as const;
export type IdStatus = (typeof ID_STATUSES)[number];
export const ID_MAX_BYTES = 10 * 1024 * 1024;
export const ID_CHUNK_CHARS = 480_000;
export const ID_RETENTION_DAYS = 730;
export const ID_REJECTED_HOLD_DAYS = 90;

const MIME = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
} as const;

export type IdMime = keyof typeof MIME;
export type IdentityFileInput = { mime: string; base64: string };

export function idTypeLabel(type: string) {
  if (type === "passport") return "Passport";
  if (type === "national_id") return "National ID Card";
  if (type === "driving_licence") return "Driving Licence";
  return "";
}

export function idNeedsBack(type: string) {
  return type === "national_id" || type === "driving_licence";
}

export function isIdType(value: string): value is IdType {
  return (ID_TYPES as readonly string[]).includes(value);
}

export function isIdMime(value: string): value is IdMime {
  return value === "image/jpeg" || value === "image/png" || value === "application/pdf";
}

export function isIdSide(value: string) {
  return value === "front" || value === "back" || value === "selfie";
}

export function base64ByteLength(value: string) {
  const raw = String(value || "").replace(/\s/g, "").replace(/=+$/, "");
  if (!raw || !/^[A-Za-z0-9+/]+$/.test(raw)) return 0;
  return Math.floor((raw.length * 3) / 4);
}

export function splitIdentityPayload(base64: string, size = ID_CHUNK_CHARS) {
  const raw = String(base64 || "").replace(/\s/g, "");
  if (!raw) return [];
  const parts: string[] = [];
  for (let i = 0; i < raw.length; i += size) parts.push(raw.slice(i, i + size));
  return parts;
}

export function identityFileError(input: { mime: string; base64: string }) {
  if (!isIdMime(input.mime)) return "Upload a JPG, PNG, or PDF.";
  const bytes = base64ByteLength(input.base64);
  if (bytes < 32) return "That file looks empty.";
  if (bytes > ID_MAX_BYTES) return "Each identity file must be 10 MB or smaller.";
  return null;
}

export function identityMetaError(input: { legalName: string; country: string; idType: string; consent: boolean }) {
  if (input.legalName.trim().length < 2) return "Full name is required.";
  if (!isCountryName(input.country)) return "Select a country of residence.";
  if (!isIdType(input.idType)) return "Choose Passport, National ID Card, or Driving Licence.";
  if (!input.consent) return "Consent is required before identity documents are collected.";
  return null;
}

export function identityFormError(input: {
  legalName: string;
  country: string;
  idType: string;
  consent: boolean;
  front: IdentityFileInput | null;
  back: IdentityFileInput | null;
  selfie: IdentityFileInput | null;
}) {
  const meta = identityMetaError(input);
  if (meta) return meta;
  if (!input.front) return "Upload the front of the government ID.";
  const frontError = identityFileError(input.front);
  if (frontError) return frontError;
  if (!input.selfie) return "Upload a selfie for identity verification.";
  const selfieError = identityFileError(input.selfie);
  if (selfieError) return selfieError;
  if (idNeedsBack(input.idType)) {
    if (!input.back) return "Upload the back of the government ID.";
    const backError = identityFileError(input.back);
    if (backError) return backError;
  }
  return null;
}

export function identityFilesReady(sides: string[], idType: string) {
  const has = new Set(sides);
  if (!has.has("front") || !has.has("selfie")) return false;
  if (idNeedsBack(idType) && !has.has("back")) return false;
  return true;
}

export function fileMatchesMime(bytes: Uint8Array, mime: string) {
  if (!isIdMime(mime)) return false;
  const sig = MIME[mime];
  if (bytes.length < sig.length) return false;
  return sig.every((byte, index) => bytes[index] === byte);
}

/** New applications need a verified ID. Advisors approved before ID collection have no record. */
export function approvalGoesLive(identityStatus: string | null) {
  return identityStatus === "verified";
}

export function manualLiveAllowed(identityStatus: string | null) {
  return identityStatus == null || identityStatus === "verified";
}

export function identityPastRetention(createdAt: string, status: string, now = Date.now()) {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return false;
  const days = (now - at) / 86_400_000;
  if (days >= ID_RETENTION_DAYS) return true;
  return status === "rejected" && days >= ID_REJECTED_HOLD_DAYS;
}
