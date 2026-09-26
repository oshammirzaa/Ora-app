import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RecalledMessageLine({ mine }: { mine: boolean }) {
  return (
    <p className="w-full py-1 text-center text-[11px] leading-relaxed text-faint">
      {mine ? "You recalled a message" : "Message recalled"}
    </p>
  );
}

/**
 * Same bubble as before. Tap or long-press your own sent message to open
 * Recall / Cancel. Other people's messages render unchanged.
 */
export function SentMessageBubble({
  className,
  children,
  onRecall,
}: {
  className: string;
  children: ReactNode;
  onRecall?: () => Promise<unknown>;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const blockClick = useRef(false);
  const running = useRef(false);
  const swallowClick = useRef(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number; above: boolean } | null>(null);

  function clearHold() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }

  function openMenu() {
    const el = bubbleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 168;
    const above = rect.top > 108;
    setMenu({
      top: above ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width)),
      above,
    });
  }

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  if (!onRecall) return <div className={className}>{children}</div>;

  function consumeHoldClick() {
    if (!swallowClick.current) return false;
    swallowClick.current = false;
    return true;
  }

  async function confirm() {
    if (consumeHoldClick()) return;
    if (!onRecall || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await onRecall();
      setMenu(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not recall");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      ref={bubbleRef}
      className={cn(className, "relative touch-manipulation")}
      style={{ WebkitTouchCallout: "none" }}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start.current = { x: event.clientX, y: event.clientY };
        timer.current = window.setTimeout(() => {
          timer.current = null;
          blockClick.current = true;
          swallowClick.current = true;
          openMenu();
        }, 480);
      }}
      onPointerMove={(event) => {
        if (!start.current || timer.current == null) return;
        if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) clearHold();
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onClickCapture={(event) => {
        if (!blockClick.current) return;
        blockClick.current = false;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, a")) return;
        openMenu();
      }}
    >
      {children}
      {menu && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default bg-transparent"
                aria-label="Cancel"
                onClick={() => {
                  if (consumeHoldClick()) return;
                  setMenu(null);
                }}
              />
              <div
                role="menu"
                aria-label="Message actions"
                className="fixed z-40 w-[10.5rem] overflow-hidden rounded-2xl bg-surface text-left shadow-[var(--shadow-border-hover)]"
                style={{ top: menu.top, left: menu.left, transform: menu.above ? "translateY(-100%)" : undefined }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2.5 text-left text-sm text-fg hover:bg-elevated disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void confirm()}
                >
                  {busy ? "Recalling…" : "Recall Message"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full border-t border-border px-3 py-2.5 text-left text-sm text-muted hover:bg-elevated"
                  onClick={() => {
                    if (consumeHoldClick()) return;
                    setMenu(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
