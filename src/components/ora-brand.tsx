import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cachedPublicSettings } from "@/lib/client-cache";
import { isCustomOraLogo } from "@/lib/ora-brand";
import { type OraMarkTarget } from "@/lib/ora-home-route";
import { useOraMarkTarget } from "@/lib/use-account-home";
import { cn } from "@/lib/utils";

export { isCustomOraLogo } from "@/lib/ora-brand";

const ORA_LOCKUP = "/images/ora-header-logo.webp";

/** Approved Ora Psychic lockup. Proportions stay fixed; only the height changes. */
export function OraBrandMark({ className }: { className?: string }) {
  return (
    <img
      src={ORA_LOCKUP}
      alt=""
      className={cn("h-14 w-auto max-w-none object-contain outline-none", className)}
    />
  );
}

export function OraLockup({ className }: { className?: string }) {
  return (
    <img
      src={ORA_LOCKUP}
      alt="Ora Psychic Readings"
      className={cn("h-16 w-auto max-w-full object-contain outline-none", className)}
    />
  );
}

export function OraMark({
  className,
  lockup = false,
  to = "/home",
}: {
  className?: string;
  lockup?: boolean;
  to?: OraMarkTarget;
}) {
  const [name, setName] = useState("Ora");
  const [logo, setLogo] = useState("");
  const { dest, onClick } = useOraMarkTarget(to);
  useEffect(() => {
    void cachedPublicSettings()
      .then((s) => {
        if (s.name) setName(s.name);
        if (isCustomOraLogo(s.logoUrl)) setLogo(s.logoUrl);
      })
      .catch(() => {});
  }, []);
  if (!logo) {
    return (
      <Link to={dest} preload={false} onClick={onClick} className={cn("inline-flex shrink-0 items-center", className)}>
        <img
          src={ORA_LOCKUP}
          alt="Ora Psychic Readings"
          className="h-14 w-auto max-w-none object-contain outline-none"
        />
      </Link>
    );
  }
  return (
    <Link to={dest} preload={false} onClick={onClick} className={cn("flex items-center gap-2.5 text-fg", className)}>
      <img
        src={logo}
        alt=""
        className={cn("object-cover outline-none", lockup ? "size-11 rounded-full" : "size-8 rounded-full")}
      />
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
