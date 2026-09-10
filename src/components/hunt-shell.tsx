import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Hunt" },
  { to: "/leads", label: "Leads" },
] as const;

export function EmberMark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 text-fg", className)}>
      <span className="flex size-8 items-center justify-center rounded-sm bg-primary">
        <svg viewBox="0 0 24 24" className="size-4 text-primary-fg" fill="none" aria-hidden>
          <path
            d="M12 3c2.2 3.4-1 5.2.4 8.2C14.2 8.8 18 10.4 18 14.2 18 17.4 15.3 20 12 20s-6-2.6-6-5.8c0-3.2 3.1-5.6 4.4-8.4C11 4.2 11.4 3.4 12 3Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="font-display text-lg tracking-tight">Ember</span>
    </Link>
  );
}

export function HuntShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <EmberMark />
          <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="flex h-11 items-center rounded-md px-2 text-sm text-muted hover:text-fg sm:px-3"
                activeProps={{ className: "text-fg" }}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="/#check"
              className="ml-1 flex h-11 items-center rounded-md bg-primary px-2.5 text-sm text-primary-fg sm:px-3"
            >
              Check
            </a>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
