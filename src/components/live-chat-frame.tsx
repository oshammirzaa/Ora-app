import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useLiveChatViewport } from "@/lib/use-live-chat-viewport";
import { cn } from "@/lib/utils";

export function LiveChatFrame({
  header,
  banner,
  children,
  footer,
  scrollKey,
}: {
  header: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  scrollKey?: number | string;
}) {
  const frameRef = useLiveChatViewport<HTMLDivElement>();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [scrollKey]);

  return (
    <div ref={frameRef} className="ora-live-chat flex w-full flex-col overflow-hidden bg-bg">
      <header className="relative z-10 shrink-0 border-b border-border/80 bg-surface/90 px-3 py-1.5 backdrop-blur-md pt-[max(0.4rem,env(safe-area-inset-top))]">
        {header}
      </header>
      {banner ? (
        <div className="relative z-10 shrink-0 border-b border-border/70 bg-blush/80 px-3 py-1.5">{banner}</div>
      ) : null}
      <div
        ref={scrollerRef}
        className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3"
      >
        <div className="flex min-h-full flex-col justify-end gap-2 py-2">{children}</div>
      </div>
      <footer className="ora-live-chat-composer relative z-10 shrink-0 border-t border-border/80 bg-bg/92 px-3 pt-1.5 backdrop-blur-md pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {footer}
      </footer>
    </div>
  );
}

export function keepChatKeyboard(event: { preventDefault: () => void }) {
  event.preventDefault();
}

export function refocusChatInput(input: HTMLInputElement | HTMLTextAreaElement | null) {
  const focus = () => input?.focus({ preventScroll: true });
  requestAnimationFrame(focus);
  window.setTimeout(focus, 0);
}

export function LiveChatComposer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex min-w-0 flex-col gap-1", className)}>{children}</div>;
}

export function LiveChatReplyInput({
  inputRef,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(96, Math.max(44, el.scrollHeight))}px`;
  }, [value, inputRef]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <textarea
      ref={inputRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      enterKeyHint="send"
      autoComplete="off"
      autoCorrect="on"
      className="max-h-24 min-h-11 min-w-0 flex-1 resize-none rounded-3xl bg-elevated px-4 py-2.5 text-base leading-5 text-fg shadow-[var(--shadow-border)] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
    />
  );
}
