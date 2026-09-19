import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { chromeTheme } from "@/lib/ora-theme";
import appCss from "../styles.css?url";

const APP_NAME = "Ora";
const LIGHT_THEME = "#f8f6f7";

const THEME_BOOT = `(function(){document.documentElement.setAttribute("data-theme","light");})();`;

function ThemeSync() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = chromeTheme(pathname);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", LIGHT_THEME);
  }, [theme]);
  return <Toaster theme="light" position="top-center" richColors={false} />;
}

export const Route = createRootRoute({
  errorComponent: ({ error }) => (
    <main className="min-h-dvh bg-bg px-4 py-16 text-fg">
      <p className="font-display text-3xl">Something went wrong</p>
      <p className="mt-2 text-sm text-muted">{error instanceof Error ? error.message : "Try again"}</p>
      <a href="/" className="mt-6 inline-block text-primary">
        Back to Ora
      </a>
    </main>
  ),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Psychic readings. Three free minutes on first login. $10 a week for three more. Then coins.",
      },
      { name: "theme-color", content: LIGHT_THEME },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Great+Vibes&family=Outfit:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <ThemeSync />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
