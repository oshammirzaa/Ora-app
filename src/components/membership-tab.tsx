import { Link, useRouterState } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cachedMe } from "@/lib/client-cache";
import { cn } from "@/lib/utils";

function hideForPath(pathname: string) {
  if (pathname === "/advisor" || pathname.startsWith("/advisor/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password" || pathname === "/reset-password") {
    return true;
  }
  if (pathname === "/apply" || pathname.startsWith("/reading/") || pathname.startsWith("/wait/")) return true;
  if (pathname === "/membership") return true;
  return false;
}

export function MembershipTab({ afterHero = false }: { afterHero?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useCurrentUserState();
  const [member, setMember] = useState(false);
  const [heroVisible, setHeroVisible] = useState(afterHero);

  useEffect(() => {
    if (!user) {
      setMember(false);
      return;
    }
    void cachedMe()
      .then((me) => setMember(Boolean(me.wallet.membershipActive)))
      .catch(() => setMember(false));
  }, [user, pathname]);

  useEffect(() => {
    if (!afterHero) {
      setHeroVisible(false);
      return;
    }
    const hero = document.getElementById("home-hero");
    if (!hero) {
      setHeroVisible(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting && entry.intersectionRatio > 0.28),
      { threshold: [0, 0.28, 0.5, 1] },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [afterHero, pathname]);

  if (hideForPath(pathname) || member) return null;
  const show = afterHero ? !heroVisible : true;

  return (
    <Link
      to="/membership"
      preload={false}
      aria-label="Ora Membership"
      className={cn(
        "fixed top-[36%] right-0 z-30 flex flex-col items-center gap-1.5 rounded-l-2xl bg-primary py-3 pr-[0.35rem] pl-1.5 text-primary-fg shadow-[var(--shadow-border)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        show ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+10px)]",
      )}
    >
      <Crown className="size-3.5 fill-gold text-gold" strokeWidth={1.8} />
      <span className="text-[10px] font-medium tracking-[0.16em] [writing-mode:vertical-rl] rotate-180">
        Membership
      </span>
    </Link>
  );
}
