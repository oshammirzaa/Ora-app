import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { cachedPublicSettings } from "@/lib/client-cache";
import { isCustomOraLogo } from "@/lib/ora-brand";
import { cn } from "@/lib/utils";

export { isCustomOraLogo } from "@/lib/ora-brand";

/** Shared crescent + star on a gold disc. Works at 24–44px. */
export function OraBrandMark({ className }: { className?: string }) {
  const raw = useId().replace(/:/g, "");
  const disc = `ora-disc-${raw}`;
  const sheen = `ora-sheen-${raw}`;
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={disc} x1="7" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e3c48a" />
          <stop offset="0.48" stopColor="#c4a35a" />
          <stop offset="1" stopColor="#a88848" />
        </linearGradient>
        <linearGradient id={sheen} x1="10" y1="4" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff8ee" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff8ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15.25" fill={`url(#${disc})`} />
      <circle cx="16" cy="16" r="14.35" fill="none" stroke="#fff8ee" strokeOpacity="0.42" strokeWidth="0.7" />
      <circle cx="16" cy="16" r="15.25" fill={`url(#${sheen})`} />
      <path
        fill="#7a4e6c"
        d="M18.55 6.15C13.2 7.85 9.35 12.85 9.35 18.7c0 4.15 2 7.85 5.15 10.2C9.7 27.15 6.2 22.35 6.2 16.55 6.2 10 11.05 4.55 17.5 3.8c.35.75.7 1.55 1.05 2.35z"
      />
      <path fill="#fff8ee" d="M22.85 7.05l.82 2.08 2.08.82-2.08.82-.82 2.08-.82-2.08-2.08-.82 2.08-.82z" />
    </svg>
  );
}

export function OraLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="flex items-center gap-1.5">
        <OraBrandMark className="size-9" />
        <span className="font-display text-[1.7rem] leading-none font-semibold tracking-tight text-primary">Ora</span>
      </div>
      <span className="mt-1 text-[6.5px] font-medium tracking-[0.18em] text-muted uppercase">Psychic Readings</span>
    </div>
  );
}

export function OraMark({ className, lockup = false }: { className?: string; lockup?: boolean }) {
  const [name, setName] = useState("Ora");
  const [logo, setLogo] = useState("");
  useEffect(() => {
    void cachedPublicSettings()
      .then((s) => {
        if (s.name) setName(s.name);
        if (isCustomOraLogo(s.logoUrl)) setLogo(s.logoUrl);
      })
      .catch(() => {});
  }, []);
  return (
    <Link to="/" preload={false} className={cn("flex items-center gap-2.5 text-fg", className)}>
      {logo ? (
        <img
          src={logo}
          alt=""
          className={cn("object-cover outline-none", lockup ? "size-11 rounded-full" : "size-8 rounded-full")}
        />
      ) : (
        <OraBrandMark className={lockup ? "size-11" : "size-8"} />
      )}
      <span className={cn("flex min-w-0 flex-col", lockup ? "leading-none" : "")}>
        <span
          className={cn(
            "font-display tracking-tight text-primary",
            lockup ? "text-[1.85rem] leading-none" : "text-lg",
          )}
        >
          {name}
        </span>
        {lockup ? (
          <span className="mt-1 text-[11px] font-normal tracking-wide text-muted">Psychic Readings</span>
        ) : null}
      </span>
    </Link>
  );
}
