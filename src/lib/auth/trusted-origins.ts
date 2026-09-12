/** Exact origins Better Auth may accept for email/password POSTs. No wildcards. */

const LOCAL_DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
] as const;

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Normalize a URL or host to `https://host` (or loopback http). Reject wildcards. */
export function toOrigin(value?: string | null, opts?: { httpsOnly?: boolean }): string | undefined {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("*") || raw.includes(" ") || raw.includes("/../")) return undefined;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (url.username || url.password) return undefined;
  if (opts?.httpsOnly && url.protocol !== "https:" && !isLoopbackHost(url.hostname)) return undefined;
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) return undefined;
  return url.origin;
}

export function extraTrustedOrigins(csv?: string | null): string[] {
  if (!csv) return [];
  const out: string[] = [];
  for (const part of csv.split(",")) {
    const origin = toOrigin(part, { httpsOnly: true });
    if (origin) out.push(origin);
  }
  return out;
}

export function resolveBetterAuthBaseURL(input: {
  betterAuthUrl?: string | null;
  vercelProductionUrl?: string | null;
  vercelUrl?: string | null;
  isVercel?: boolean;
}): string | undefined {
  return (
    toOrigin(input.betterAuthUrl) ||
    (input.isVercel
      ? toOrigin(input.vercelProductionUrl) || toOrigin(input.vercelUrl)
      : undefined)
  );
}

export function collectTrustedOrigins(input: {
  betterAuthUrl?: string | null;
  vercelUrl?: string | null;
  vercelProductionUrl?: string | null;
  extra?: string | null;
  previewHosts?: readonly string[];
  includeLocalDev?: boolean;
}): string[] {
  const out = new Set<string>();
  const add = (value?: string | null) => {
    const origin = toOrigin(value, { httpsOnly: true });
    if (origin) out.add(origin);
  };
  add(input.betterAuthUrl);
  add(input.vercelProductionUrl);
  add(input.vercelUrl);
  for (const origin of extraTrustedOrigins(input.extra)) out.add(origin);
  if (input.includeLocalDev) {
    for (const origin of LOCAL_DEV_ORIGINS) out.add(origin);
    for (const host of input.previewHosts || []) {
      out.add(host);
      if (!host.includes("*")) add(host);
      else {
        out.add(`https://${host}`);
        out.add(`http://${host}`);
      }
    }
  }
  return [...out];
}
