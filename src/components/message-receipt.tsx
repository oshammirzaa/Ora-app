import { cn } from "@/lib/utils";

export function MessageReceipt({ receipt, onPrimary = false }: { receipt?: string | null; onPrimary?: boolean }) {
  if (receipt !== "sent" && receipt !== "delivered" && receipt !== "seen") return null;
  return (
    <span
      className={cn(
        "mt-1 block text-right text-[10px] leading-none tracking-tight",
        receipt === "seen" ? "font-medium text-gold" : onPrimary ? "text-primary-fg/70" : "text-faint",
      )}
      aria-label={receipt === "seen" ? "Seen" : receipt === "delivered" ? "Delivered" : "Sent"}
    >
      {receipt === "sent" ? "✓" : "✓✓"}
    </span>
  );
}
