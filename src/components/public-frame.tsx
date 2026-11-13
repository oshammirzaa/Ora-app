import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { OraMark } from "@/components/ora-brand";
import { StoreBadges } from "@/components/store-badges";
import { PUBLIC_CATEGORIES } from "@/lib/ora-public-categories";
import { appHref } from "@/lib/ora-domains";
import { useOraMarkTarget } from "@/lib/use-account-home";

export function PublicFrame({
  marketingHost,
  supportEmail,
  children,
}: {
  marketingHost: boolean;
  supportEmail?: string;
  children: ReactNode;
}) {
  return (
    <div className="ora-public min-h-dvh bg-[#fffdfb] text-[#2a2430]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg">
        Skip to content
      </a>
      <PublicHeader marketingHost={marketingHost} />
      <div id="main">{children}</div>
      <PublicFooter marketingHost={marketingHost} supportEmail={supportEmail} />
    </div>
  );
}

function PublicHeader({ marketingHost }: { marketingHost: boolean }) {
  const [open, setOpen] = useState(false);
  const [advisorsOpen, setAdvisorsOpen] = useState(false);
  const menuId = useId();
  const signIn = appHref("/login", marketingHost);
  const signUp = appHref("/signup", marketingHost);

  useEffect(() => {
    if (!advisorsOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAdvisorsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advisorsOpen]);

  function close() {
    setOpen(false);
    setAdvisorsOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#efe4ea] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <WebsiteHeaderLogo />
        <form action="/psychics" role="search" className="mx-1 hidden min-w-0 flex-1 md:block" onSubmit={close}>
          <SearchField />
        </form>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Public">
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[#2a2430]"
              aria-expanded={advisorsOpen}
              aria-controls={menuId}
              onClick={() => setAdvisorsOpen((value) => !value)}
            >
              Advisors
              <ChevronDown className="size-4" strokeWidth={2.25} />
            </button>
            {advisorsOpen ? (
              <button type="button" aria-label="Close advisor categories" className="fixed inset-0 z-30 cursor-default" onClick={() => setAdvisorsOpen(false)} />
            ) : null}
            {advisorsOpen ? (
              <div id={menuId} className="absolute right-0 z-50 mt-2 w-[min(34rem,80vw)] rounded-2xl border border-[#efe4ea] bg-white p-3 shadow-[0_18px_40px_-24px_rgba(42,36,48,0.35)]">
                <CategoryLinks onNavigate={close} />
              </div>
            ) : null}
          </div>
          <a href={appHref("/membership", marketingHost)} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-[#2a2430]">
            Membership
          </a>
          <a href={appHref("/account", marketingHost)} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-[#2a2430]">
            Wallet
          </a>
          <a href={signIn} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-[#2a2430]">
            Sign In
          </a>
          <a href={signUp} className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg">
            Sign Up
          </a>
        </nav>
        <a href={signIn} className="ml-auto hidden h-10 items-center px-2 text-sm font-semibold text-[#2a2430] sm:inline-flex lg:hidden">
          Sign In
        </a>
        <a href={signUp} className="inline-flex h-10 items-center rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-fg lg:hidden">
          Sign Up
        </a>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full border border-[#eadfe6] bg-white lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" strokeWidth={2.25} /> : <Menu className="size-5" strokeWidth={2.25} />}
        </button>
      </div>
      <form action="/psychics" role="search" className="px-4 pb-3 md:hidden" onSubmit={close}>
        <SearchField />
      </form>
      {open ? (
        <nav className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto border-t border-[#efe4ea] px-4 py-3 lg:hidden" aria-label="Public mobile">
          <a href={signIn} className="flex h-11 items-center text-sm font-semibold" onClick={close}>
            Sign In
          </a>
          <a href={signUp} className="flex h-11 items-center text-sm font-semibold text-primary" onClick={close}>
            Sign Up
          </a>
          <a href={appHref("/membership", marketingHost)} className="flex h-11 items-center text-sm font-semibold" onClick={close}>
            Membership
          </a>
          <a href={appHref("/account", marketingHost)} className="flex h-11 items-center text-sm font-semibold" onClick={close}>
            Wallet
          </a>
          <p className="mt-2 text-xs font-semibold tracking-wide text-[#72687a] uppercase">Advisors</p>
          <CategoryLinks stacked onNavigate={close} />
          {marketingHost ? (
            <a href={appHref("/advisor/signup", marketingHost)} className="mt-2 flex h-11 items-center text-sm font-semibold" onClick={close}>
              Become an Advisor
            </a>
          ) : null}
          <a href={appHref("/advisor/login", marketingHost)} className="flex h-11 items-center text-sm font-semibold" onClick={close}>
            Advisor Login
          </a>
        </nav>
      ) : null}
    </header>
  );
}

function WebsiteHeaderLogo() {
  const { dest, onClick } = useOraMarkTarget("/");
  return (
    <Link
      to={dest}
      preload={false}
      onClick={onClick}
      aria-label="Ora Psychic Readings home"
      className="inline-flex shrink-0 items-center"
    >
      <img
        src="/images/ora-header-logo.webp"
        alt=""
        width={1329}
        height={628}
        className="h-14 w-auto object-contain"
      />
    </Link>
  );
}

function SearchField() {
  return (
    <label className="relative block">
      <span className="sr-only">Search advisors</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" strokeWidth={2.25} />
      <input
        name="q"
        placeholder="Search advisors"
        className="h-11 w-full rounded-full border border-[#eadfe6] bg-white pr-4 pl-10 text-sm font-semibold outline-none placeholder:font-medium placeholder:text-[#a39aaa] focus:border-primary"
      />
    </label>
  );
}

function CategoryLinks({ onNavigate, stacked = false }: { onNavigate: () => void; stacked?: boolean }) {
  return (
    <div className={stacked ? "grid" : "grid grid-cols-2 gap-1"}>
      {PUBLIC_CATEGORIES.map((category) =>
        category.board === "new" ? (
          <Link
            key={category.id}
            to="/psychics"
            search={{ board: "new" }}
            onClick={onNavigate}
            className="flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-[#2a2430] hover:bg-[#fbf6ea]"
          >
            {category.label}
          </Link>
        ) : (
          <Link
            key={category.id}
            to="/psychics"
            search={{ category: category.id }}
            onClick={onNavigate}
            className="flex h-11 items-center rounded-xl px-2 text-sm font-semibold text-[#2a2430] hover:bg-[#fbf6ea]"
          >
            {category.label}
          </Link>
        ),
      )}
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
    <footer id="contact" className="border-t border-[#efe4ea] bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <OraMark lockup to="/" />
          <p className="mt-3 max-w-xs text-sm font-medium leading-relaxed text-[#5c5366]">
            Private live chat with published Ora advisors. Entertainment only. Not medical, legal, or financial advice.
          </p>
          <StoreBadges className="mt-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2a2430]">Popular services</p>
          <ul className="mt-3 space-y-1 text-sm font-semibold">
            {PUBLIC_CATEGORIES.filter((category) =>
              ["psychic-readings", "love", "tarot", "astrology", "career", "mediums"].includes(category.id),
            ).map((category) => (
              <li key={category.id}>
                <Link to="/psychics" search={{ category: category.id }} className="inline-flex h-11 items-center text-[#5c5366]">
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2a2430]">Ora Psychic</p>
          <ul className="mt-3 space-y-1 text-sm font-semibold">
            <li>
              <Link to="/about" className="inline-flex h-11 items-center text-[#5c5366]">
                About Ora Psychic
              </Link>
            </li>
            <li>
              <a href="/#how-ora-works" className="inline-flex h-11 items-center text-[#5c5366]">
                How It Works
              </a>
            </li>
            {marketingHost ? (
              <li>
                <a href={appHref("/advisor/signup", marketingHost)} className="inline-flex h-11 items-center text-[#5c5366]">
                  Become an Advisor
                </a>
              </li>
            ) : null}
            <li>
              <a href={appHref("/advisor/login", marketingHost)} className="inline-flex h-11 items-center text-[#5c5366]">
                Advisor Login
              </a>
            </li>
            <li>
              <a href={appHref("/login", marketingHost)} className="inline-flex h-11 items-center text-[#5c5366]">
                Customer Login
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#2a2430]">Support</p>
          <ul className="mt-3 space-y-1 text-sm font-semibold">
            <li>
              <a href={appHref("/support", marketingHost)} className="inline-flex h-11 items-center text-[#5c5366]">
                Contact and Support
              </a>
            </li>
            {supportEmail ? (
              <li>
                <a href={`mailto:${supportEmail}`} className="inline-flex h-11 items-center text-[#5c5366]">
                  {supportEmail}
                </a>
              </li>
            ) : null}
            <li>
              <Link to="/privacy" className="inline-flex h-11 items-center text-[#5c5366]">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="inline-flex h-11 items-center text-[#5c5366]">
                Terms & Conditions
              </Link>
            </li>
            <li>
              <a href="/terms#billing" className="inline-flex h-11 items-center text-[#5c5366]">
                Billing and refunds
              </a>
            </li>
            <li>
              <a href="/privacy#cookies" className="inline-flex h-11 items-center text-[#5c5366]">
                Cookie notice
              </a>
            </li>
            <li>
              <Link to="/delete-account" className="inline-flex h-11 items-center text-[#5c5366]">
                Delete account
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="px-4 pb-8 text-center text-xs font-medium text-[#72687a]">© {new Date().getFullYear()} Ora Psychic. Readings are for entertainment.</p>
    </footer>
  );
}
