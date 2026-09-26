import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import { deviceLabel, trustedClientIp } from "@/lib/ora-ip-security";

/** Server-only login observation. The IP is never taken from the caller body. */
export async function readLoginObservation() {
  const request = getRequest();
  const headers = request?.headers;
  const ip = headers ? trustedClientIp(headers) : "";
  const userAgent = String(headers?.get("user-agent") || "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 240);
  let token = "";
  try {
    const { readSessionToken } = await import("@/lib/auth/server");
    token = String(readSessionToken() || "");
  } catch {
    token = "";
  }
  if (!token) {
    const header = String(headers?.get("authorization") || "");
    const match = /^Bearer\s+(\S+)/i.exec(header);
    token = match?.[1] || "";
  }
  const sessionKey = token ? createHash("sha256").update(token).digest("hex") : "";
  return { ip, userAgent, device: deviceLabel(userAgent), sessionKey };
}
