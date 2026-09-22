import { chatMessageWordState } from "@/lib/ora-chat-words";
import { cn } from "@/lib/utils";

export function ChatWordMeter({ value, className }: { value: string; className?: string }) {
  const state = chatMessageWordState(value);
  return (
    <div className={cn("mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] tabular-nums", className)}>
      {state.over ? <span className="text-warn">Maximum 300 words per message</span> : null}
      <span className={state.over ? "text-warn" : "text-faint"}>{state.label}</span>
    </div>
  );
}
