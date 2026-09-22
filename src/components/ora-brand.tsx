import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { cachedPublicSettings } from "@/lib/client-cache";
import { isCustomOraLogo } from "@/lib/ora-brand";
import { cn } from "@/lib/utils";

export { isCustomOraLogo } from "@/lib/ora-brand";

/** Shared crescent, lotus and star on a gold disc. Works at 24–44px. */
export function OraBrandMark({ className }: { className?: string }) {
  const raw = useId().replace(/:/g, "");
  const disc = `ora-disc-${raw}`;
  const moon = `ora-moon-${raw}`;
  const gold = `ora-gold-${raw}`;
  const lotus = `ora-lotus-${raw}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={disc} x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0ddb0" />
          <stop offset="0.46" stopColor="#d4b06a" />
          <stop offset="1" stopColor="#b08a46" />
        </linearGradient>
        <linearGradient id={moon} x1="12" y1="8" x2="42" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b07cbc" />
          <stop offset="0.42" stopColor="#7a4a8c" />
          <stop offset="1" stopColor="#4f2c5e" />
        </linearGradient>
        <linearGradient id={gold} x1="14" y1="6" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7ebc6" />
          <stop offset="0.5" stopColor="#d4af6a" />
          <stop offset="1" stopColor="#b8924a" />
        </linearGradient>
        <linearGradient id={lotus} x1="28" y1="24" x2="42" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d4b4e0" />
          <stop offset="0.55" stopColor="#9a68ac" />
          <stop offset="1" stopColor="#6d3d7e" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31.2" fill={`url(#${disc})`} />
      <circle cx="32" cy="32" r="29.6" fill="none" stroke="#fff8ee" strokeOpacity="0.5" strokeWidth="1.1" />
      <circle cx="32" cy="32" r="27.4" fill="#fbf6ee" />
      <path
        fill={`url(#${moon})`}
        stroke={`url(#${gold})`}
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M43.2 11.2c-12.6 2.6-22 14.2-22 27.6 0 8.4 3.8 16 9.8 21.1C18.6 55.2 11.2 44.8 11.2 32.6 11.2 18.2 22.2 6.4 37.2 5.2c1.6 1.8 4.1 4.1 6 6z"
      />
      <path
        fill="none"
        stroke="#f7ebc6"
        strokeOpacity="0.35"
        strokeWidth="1.1"
        d="M39.6 13.4c-10.6 2.6-18.4 12.2-18.4 23.4 0 6.6 2.7 12.6 7.1 16.8"
      />
      <g fill={`url(#${lotus})`}>
        <ellipse cx="36.2" cy="38.4" rx="4.1" ry="9.2" transform="rotate(-32 36.2 38.4)" />
        <ellipse cx="41.8" cy="38.4" rx="4.1" ry="9.2" transform="rotate(32 41.8 38.4)" />
        <ellipse cx="39" cy="37.2" rx="3.5" ry="10.2" />
      </g>
      <path
        fill={`url(#${gold})`}
        d="M40.00,9.80L40.90,13.83L44.38,11.62L42.17,15.10L46.20,16.00L42.17,16.90L44.38,20.38L40.90,18.17L40.00,22.20L39.10,18.17L35.62,20.38L37.83,16.90L33.80,16.00L37.83,15.10L35.62,11.62L39.10,13.83Z"
      />
      <path
        fill="#fff8ee"
        fillOpacity="0.9"
        d="M22.00,12.40L22.23,13.45L23.13,12.87L22.55,13.77L23.60,14.00L22.55,14.23L23.13,15.13L22.23,14.55L22.00,15.60L21.77,14.55L20.87,15.13L21.45,14.23L20.40,14.00L21.45,13.77L20.87,12.87L21.77,13.45Z"
      />
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
