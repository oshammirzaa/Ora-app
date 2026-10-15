function GooglePlayMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 shrink-0" aria-hidden>
      <path fill="#f4b400" d="M3.2 2.6c-.4.4-.6 1-.6 1.8v15.2c0 .8.2 1.4.6 1.8l.1.1 8.5-8.5v-.2L3.3 2.5l-.1.1Z" />
      <path fill="#de5f94" d="m14.7 14.8-2.5-2.5v-.2l2.5-2.5.1.1 3 1.7c.8.5.8 1.2 0 1.7l-3.1 1.7Z" />
      <path fill="#6d3d78" d="M14.8 14.7 12.2 12 3.2 21.4c.3.3.8.3 1.3.1l10.3-6.8Z" />
      <path fill="#8d6b32" d="m14.8 9.3-10.3-6.8c-.5-.3-1-.2-1.3.1L12.2 12l2.6-2.7Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 shrink-0 fill-current" aria-hidden>
      <path d="M16.4 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8s-1.7-.8-2.9-.8c-1.5 0-2.8.9-3.6 2.2-1.5 2.7-.4 6.6 1.1 8.8.7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7 1.9-1.1 2.6-2.1c.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.2-3.6Zm-2-6.6c.6-.7 1-1.7.9-2.7-0.9 0-1.9.6-2.5 1.3-.6.6-1.1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2Z" />
    </svg>
  );
}

function Badge({
  store,
  title,
  subtitle,
}: {
  store: "google" | "apple";
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-14 min-w-[13.5rem] items-center gap-3 rounded-xl bg-[#2a2430] px-3.5 py-2 text-left text-white shadow-[var(--shadow-border)]">
      {store === "google" ? <GooglePlayMark /> : <AppleMark />}
      <span>
        <span className="block text-[10px] tracking-wide text-white/70 uppercase">{subtitle}</span>
        <span className="block font-medium leading-tight">{title}</span>
        <span className="mt-0.5 block text-[11px] text-[#ead7ae]">Coming Soon</span>
      </span>
    </div>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-muted">Available on Google Play and the App Store.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Badge store="google" subtitle="Get it on" title="Google Play" />
        <Badge store="apple" subtitle="Download on the" title="App Store" />
      </div>
    </div>
  );
}