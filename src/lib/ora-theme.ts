/** Advisor desk and admin stay dark. Customer `/advisors` browse must stay light. */
export function chromeTheme(pathname: string): "light" | "dark" {
  if (pathname === "/advisor" || pathname.startsWith("/advisor/")) return "dark";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "dark";
  return "light";
}
