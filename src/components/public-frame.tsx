import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { OraMark } from "@/components/ora-brand";
import { appHref } from "@/lib/ora-domains";

export function PublicFrame({
  marketingHost,
  supportEmail,
  children,
}: {
  marketingHost: boolean;
  supportEmail?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const signIn = appHref("/login", marketingHost);
  const signUp = appHref("/signup", marketingHost);

  function close() {
    setOpen(false);
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <OraMark to="/" className="sm:hidden" />
          <OraMark lockup to="/" className="hidden sm:flex" />
          <div className="flex items-center gap-2">
            <a href={signIn} className="inline-flex h-10 items-center px-2 text-sm text-fg md:hidden">
              Sign In
            </a>
            <a
              href={signUp}
              className="inline-flex h-10 items-center rounded-full bg-primary px-3.5 text-sm font-medium text-primary-fg md:hidden"
            >
              Sign Up
            </a>
            <nav className="hidden items-center gap-2 md:flex" aria-label="Public">
              <a href="/#advisors" className="inline-flex h-11 items-center rounded-full px-3 text-sm text-muted hover:text-fg">
                Advisors
              </a>
              <Link to="/about" className="inline-flex h-11 items-center rounded-full px-3 text-sm text-muted hover:text-fg">
                About
              </Link>
              <a href={signIn} className="inline-flex h-11 items-center rounded-full px-3 text-sm text-fg">
                Sign In
              </a>
              <a href={signUp} className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg">
                Sign Up
              </a>
            </nav>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full border border-border bg-surface md:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="border-t border-border px-4 py-2 md:hidden" aria-label="Public mobile">
            <a href={signIn} className="flex h-11 items-center text-sm" onClick={close}>
              Sign In
            </a>
            <a href={signUp} className="flex h-11 items-center text-sm text-primary" onClick={close}>
              Sign Up
            </a>
            <a href="/#advisors" className="flex h-11 items-center text-sm" onClick={close}>
              Advisors
            </a>
            <Link to="/about" className="flex h-11 items-center text-sm" onClick={close}>
              About Ora
            </Link>
            <a href={appHref("/advisor/signup", marketingHost)} className="flex h-11 items-center text-sm" onClick={close}>
              Become an Advisor
            </a>
            <a href={appHref("/advisor/login", marketingHost)} className="flex h-11 items-center text-sm" onClick={close}>
              Advisor Login
            </a>
          </nav>
        ) : null}
      </header>
      {children}
      <PublicFooter marketingHost={marketingHost} supportEmail={supportEmail} />
    </div>
  );
}

export function PublicFooter({
  marketingHost,
  supportEmail,
}: {
  marketingHost: boolean;
  supportEmail?: string;
}) {
  return (
    <footer id="contact" className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <OraMark lockup to="/" />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Guidance through a private conversation. Entertainment only. Not medical, legal, or financial advice.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-fg">Explore</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li><Link to="/about" className="inline-flex h-11 items-center text-muted">About Ora</Link></li>
            <li><a href="/#advisors" className="inline-flex h-11 items-center text-muted">Advisors</a></li>
            <li>
              <a href={appHref("/advisor/signup", marketingHost)} className="inline-flex h-11 items-center text-muted">
                Become an Advisor
              </a>
            </li>
            <li>
              <a href={appHref("/advisor/login", marketingHost)} className="inline-flex h-11 items-center text-muted">
                Advisor Login
              </a>
            </li>
            <li>
              <a href={appHref("/login", marketingHost)} className="inline-flex h-11 items-center text-muted">
                Customer Login
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-fg">Support</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              <a href={appHref("/support", marketingHost)} className="inline-flex h-11 items-center text-muted">
                Contact
              </a>
            </li>
            {supportEmail ? (
              <li>
                <a href={`mailto:${supportEmail}`} className="inline-flex h-11 items-center text-muted">
                  {supportEmail}
                </a>
              </li>
            ) : null}
            <li><Link to="/privacy" className="inline-flex h-11 items-center text-muted">Privacy</Link></li>
            <li><Link to="/terms" className="inline-flex h-11 items-center text-muted">Terms</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-fg">Ora</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            This website is orapsychic.com. Readings, wallet, and membership stay in the Ora app.
          </p>
        </div>
      </div>
      <p className="px-4 pb-8 text-center text-xs text-muted">© {new Date().getFullYear()} Ora Psychic</p>
    </footer>
  );
}
