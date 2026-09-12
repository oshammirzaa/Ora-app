export function isGrokEmbedderOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "grok.com" || host.endsWith(".grok.com")) return true;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    return false;
  } catch {
    return false;
  }
}

export function isSandboxPreviewGuestHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}

function isRemintPreviewPair(guestHost: string, parentHost: string): boolean {
  const guest = guestHost.toLowerCase();
  const parent = parentHost.toLowerCase();
  const sep = ".preview.";
  const i = guest.indexOf(sep);
  if (i <= 0) return false;
  const label = guest.slice(0, i);
  const rest = guest.slice(i + sep.length);
  if (label.includes(".") || !rest.includes(".")) return false;
  return parent === rest || parent === `grok.${rest}`;
}

export function resolveParentEmbedderOrigin(
  parentIsSelf: boolean,
  referrer: string,
  ancestorOrigin?: string | null,
  guestHostname: string = "",
): string | null {
  if (parentIsSelf) return null;
  for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) {
    try {
      const url = new URL(
        candidate.includes("://") ? candidate : `https://${candidate}`,
      );
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (isGrokEmbedderOrigin(url.origin)) return url.origin;
      if (
        isSandboxPreviewGuestHost(guestHostname) ||
        isRemintPreviewPair(guestHostname, url.hostname)
      ) {
        return url.origin;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function isGrokPreviewAdminEntry(input: {
  pathname?: string;
  hostname?: string;
  parentIsSelf?: boolean;
  referrer?: string;
}): boolean {
  const path = input.pathname || "/";
  if (path !== "/" && path !== "") return false;
  if (isSandboxPreviewGuestHost(input.hostname || "")) return true;
  if (input.parentIsSelf !== false) return false;
  const ref = input.referrer || "";
  if (!ref) return false;
  try {
    const url = new URL(ref.includes("://") ? ref : `https://${ref}`);
    const host = url.hostname.toLowerCase();
    return host === "grok.com" || host.endsWith(".grok.com") || isSandboxPreviewGuestHost(host);
  } catch {
    return false;
  }
}

export function isGrokPreviewAdminRedirect(input: {
  method?: string;
  pathname?: string;
  accept?: string;
  fetchDest?: string;
  host?: string;
  forwardedHost?: string;
  referer?: string;
  grokIdentity?: string;
}): boolean {
  if ((input.method || "GET").toUpperCase() !== "GET" && (input.method || "").toUpperCase() !== "HEAD") return false;
  const path = input.pathname || "/";
  if (path !== "/" && path !== "") return false;
  const dest = (input.fetchDest || "").toLowerCase();
  if (dest && dest !== "document" && dest !== "iframe") return false;
  const accept = (input.accept || "").toLowerCase();
  if (accept && !accept.includes("text/html")) return false;
  if ((input.grokIdentity || "").trim()) return true;
  const host = `${input.forwardedHost || ""} ${input.host || ""}`.toLowerCase();
  if (host.includes("grok-sandbox.com")) return true;
  const ref = (input.referer || "").toLowerCase();
  return ref.includes("grok.com") || ref.includes("grok-sandbox.com");
}
