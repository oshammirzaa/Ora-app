/** Pure advisor IP monitoring. Report only. Never labels a shared network as fraud. */

export const SHARED_IP_STATUS_CLEAR = "No duplicate detected";
export const SHARED_IP_STATUS_MATCH = "Potential Shared IP";
export const SHARED_IP_CATEGORY = "shared_ip";
export const SHARED_IP_CATEGORY_LABEL = "Shared IP Detection";

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export type HeaderBag = { get(name: string): string | null | undefined };

export function cleanText(value: unknown, max: number) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
}

export function normalizeIp(raw: unknown) {
  let value = cleanText(raw, 80).replace(/^"|"$/g, "");
  if (!value || value.toLowerCase() === "unknown") return "";
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    value = end > 1 ? value.slice(1, end) : "";
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }
  value = value.toLowerCase();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value === "::1") return "127.0.0.1";
  if (IPV4.test(value)) return value;
  if (value.includes(":") && /^[0-9a-f:]+$/.test(value) && value.length <= 45) return value;
  return "";
}

function firstIp(header: string | null | undefined) {
  for (const part of String(header || "").split(",")) {
    const ip = normalizeIp(part);
    if (ip) return ip;
  }
  return "";
}

/**
 * Client IP from platform-owned headers only.
 * Vercel overwrites `x-vercel-forwarded-for`. Cloudflare pairs `cf-connecting-ip` with `cf-ray`.
 * A caller-supplied forwarded-for list is not read.
 */
export function trustedClientIp(headers: HeaderBag) {
  const vercelList = headers.get("x-vercel-forwarded-for");
  const onVercel = Boolean(vercelList || headers.get("x-vercel-id"));
  if (onVercel) {
    const fromVercel = firstIp(vercelList);
    if (fromVercel) return fromVercel;
    const real = firstIp(headers.get("x-real-ip"));
    if (real) return real;
  }
  if (headers.get("cf-ray") && headers.get("cf-connecting-ip")) {
    const cloudflare = firstIp(headers.get("cf-connecting-ip"));
    if (cloudflare) return cloudflare;
  }
  return "";
}

export function isPublicIp(ip: string) {
  const value = normalizeIp(ip);
  if (!value) return false;
  if (value === "127.0.0.1" || value === "0.0.0.0" || value === "::") return false;
  if (value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("169.254.")) return false;
  const rfc1918 = /^172\.(\d+)\./.exec(value);
  if (rfc1918) {
    const octet = Number(rfc1918[1]);
    if (octet >= 16 && octet <= 31) return false;
  }
  if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return false;
  return true;
}

export function deviceLabel(userAgent: string) {
  const ua = cleanText(userAgent, 300);
  if (!ua) return "Unknown device";
  let browser = "Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  let os = "";
  if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/mac os|macintosh/i.test(ua)) os = "Mac";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/linux/i.test(ua)) os = "Linux";
  return os ? `${browser} on ${os}` : browser;
}

export type LoginEvent = {
  advisorId: string;
  name: string;
  email: string;
  ip: string;
  at: string;
  device: string;
  userAgent: string;
};

export type AdvisorIpRow = {
  advisorId: string;
  name: string;
  email: string;
  ip: string;
  lastLogin: string;
  lastSeen: string;
  device: string;
  accountsOnIp: number;
  status: typeof SHARED_IP_STATUS_CLEAR | typeof SHARED_IP_STATUS_MATCH;
};

export function latestAdvisorIps(events: LoginEvent[]): AdvisorIpRow[] {
  const latest = new Map<string, LoginEvent>();
  for (const event of events) {
    const id = cleanText(event.advisorId, 80);
    if (!id) continue;
    const prev = latest.get(id);
    if (!prev || event.at > prev.at) latest.set(id, { ...event, advisorId: id, ip: normalizeIp(event.ip) });
  }
  const rows = [...latest.values()];
  const usersByIp = new Map<string, Set<string>>();
  for (const event of events) {
    const ip = normalizeIp(event.ip);
    const id = cleanText(event.advisorId, 80);
    if (!id || !isPublicIp(ip)) continue;
    const set = usersByIp.get(ip) || new Set<string>();
    set.add(id);
    usersByIp.set(ip, set);
  }
  return rows
    .sort((a, b) => b.at.localeCompare(a.at) || a.name.localeCompare(b.name))
    .map((row) => {
      const accounts = isPublicIp(row.ip) ? usersByIp.get(row.ip)?.size || 1 : 1;
      return {
        advisorId: row.advisorId,
        name: cleanText(row.name, 120) || "Advisor",
        email: cleanText(row.email, 160),
        ip: row.ip || "Not available",
        lastLogin: row.at,
        lastSeen: row.at,
        device: cleanText(row.device, 80) || "Unknown device",
        accountsOnIp: accounts,
        status: accounts >= 2 ? SHARED_IP_STATUS_MATCH : SHARED_IP_STATUS_CLEAR,
      };
    });
}

export type SharedIpAccount = {
  advisorId: string;
  name: string;
  email: string;
  lastLogin: string;
  device: string;
  userAgent: string;
};

export type SharedIpCluster = {
  ip: string;
  accounts: SharedIpAccount[];
  firstDetected: string;
  lastDetected: string;
  fingerprint: string;
};

export function sharedIpClusters(events: LoginEvent[]): SharedIpCluster[] {
  const grouped = new Map<string, LoginEvent[]>();
  for (const event of events) {
    const ip = normalizeIp(event.ip);
    const advisorId = cleanText(event.advisorId, 80);
    if (!advisorId || !isPublicIp(ip)) continue;
    const list = grouped.get(ip) || [];
    list.push({ ...event, advisorId, ip });
    grouped.set(ip, list);
  }
  const clusters: SharedIpCluster[] = [];
  for (const [ip, rows] of grouped) {
    const byAdvisor = new Map<string, LoginEvent>();
    let first = rows[0]?.at || "";
    let last = rows[0]?.at || "";
    for (const row of rows) {
      if (row.at < first) first = row.at;
      if (row.at > last) last = row.at;
      const prev = byAdvisor.get(row.advisorId);
      if (!prev || row.at > prev.at) byAdvisor.set(row.advisorId, row);
    }
    if (byAdvisor.size < 2) continue;
    const accounts = [...byAdvisor.values()]
      .sort((a, b) => a.advisorId.localeCompare(b.advisorId))
      .map((row) => ({
        advisorId: row.advisorId,
        name: cleanText(row.name, 120) || "Advisor",
        email: cleanText(row.email, 160),
        lastLogin: row.at,
        device: cleanText(row.device, 80) || "Unknown device",
        userAgent: cleanText(row.userAgent, 240),
      }));
    clusters.push({
      ip,
      accounts,
      firstDetected: first,
      lastDetected: last,
      fingerprint: `${ip}|${accounts.map((row) => row.advisorId).join(",")}`,
    });
  }
  return clusters.sort((a, b) => b.lastDetected.localeCompare(a.lastDetected) || a.ip.localeCompare(b.ip));
}

export function newSharedFingerprints(existing: string[], clusters: SharedIpCluster[]) {
  const seen = new Set(existing.map((item) => String(item || "")));
  return clusters.filter((cluster) => cluster.fingerprint && !seen.has(cluster.fingerprint));
}

export function sharedIpReportExcerpt(cluster: SharedIpCluster) {
  const lines = [
    SHARED_IP_STATUS_MATCH,
    "Multiple Accounts Detected on Same IP",
    `IP Address: ${cluster.ip}`,
    `Accounts detected: ${cluster.accounts.length}`,
    `First detected: ${cluster.firstDetected}`,
    `Most recent detected: ${cluster.lastDetected}`,
    "This is a report only. A shared network can be a household, office, mobile carrier, VPN, or public Wi-Fi.",
  ];
  cluster.accounts.forEach((account, index) => {
    lines.push(
      `Advisor ${index + 1}: ${account.name}`,
      `Email: ${account.email || "Not available"}`,
      `Advisor ID: ${account.advisorId}`,
      `Last login: ${account.lastLogin}`,
      `Device: ${account.device}`,
      account.userAgent ? `Browser: ${account.userAgent}` : "",
    );
  });
  return lines.filter(Boolean).join("\n").slice(0, 4000);
}

export function sharedIpReportContext(cluster: SharedIpCluster) {
  return [
    `IP ${cluster.ip}`,
    `Accounts: ${cluster.accounts.map((account) => account.name).join(", ")}`.slice(0, 180),
    `Devices: ${cluster.accounts.map((account) => account.device).join("; ")}`.slice(0, 180),
  ];
}
