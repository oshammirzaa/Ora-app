const BUILTIN_LOGOS = new Set(["", "/favicon.svg", "/images/ora-logo.png", "/images/ora-mark.svg"]);

export function isCustomOraLogo(url: unknown) {
  const value = String(url || "").trim();
  if (!value) return false;
  try {
    const path = value.startsWith("http") ? new URL(value).pathname : value.split("?")[0];
    return !BUILTIN_LOGOS.has(path);
  } catch {
    return !BUILTIN_LOGOS.has(value);
  }
}
