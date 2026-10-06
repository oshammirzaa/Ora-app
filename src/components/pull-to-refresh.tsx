import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { runOraRefresh } from "@/lib/use-ora-refresh";
import { cn } from "@/lib/utils";

const TRIGGER = 52;

/** Pull down from the top of a customer screen to reload its server data. */
export function PullToRefresh({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const start = useRef({ x: 0, y: 0, armed: false });

  useEffect(() => {
    if (disabled) return;
    const onStart = (event: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 2) {
        start.current.armed = false;
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      start.current = { x: touch.clientX, y: touch.clientY, armed: true };
    };
    const onMove = (event: TouchEvent) => {
      if (!start.current.armed || refreshingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      if (window.scrollY > 2 || dy < 10 || Math.abs(dx) > Math.abs(dy)) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      const next = Math.min((dy - 10) * 0.45, 68);
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = () => {
      if (!start.current.armed) return;
      start.current.armed = false;
      if (pullRef.current < TRIGGER) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      setRefreshing(true);
      refreshingRef.current = true;
      setPull(36);
      void Promise.all([router.invalidate(), runOraRefresh()])
        .catch(() => undefined)
        .finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        });
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [disabled, router]);

  return (
    <>
      {pull > 0 || refreshing ? (
        <div className="pointer-events-none sticky top-0 z-30 flex justify-center" style={{ height: refreshing ? 36 : pull }}>
          <span
            className={cn(
              "mt-1.5 size-5 rounded-full border-2 border-gold/50 border-t-primary bg-surface shadow-[var(--shadow-border)]",
              refreshing && "animate-spin",
            )}
            style={{ opacity: refreshing ? 1 : Math.min(1, pull / TRIGGER) }}
            role="status"
            aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
          />
        </div>
      ) : null}
      {children}
    </>
  );
}
