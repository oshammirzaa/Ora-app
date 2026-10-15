import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { createGiftIntent, giftCatalog, redeemGift } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/gifts")({ component: GiftsPage });

function GiftsPage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Awaited<ReturnType<typeof giftCatalog>> | null>(null);
  const [failed, setFailed] = useState("");
  const [coins, setCoins] = useState(0);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");

  async function load() {
    const next = await giftCatalog();
    setData(next);
    setCoins((current) => current || next.denominations[0] || 0);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => setFailed(err instanceof Error ? err.message : "Could not load gifts"));
  }, [user]);

  if (isPending || (user && !data && !failed)) return <AppShell tab="you"><div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" /></AppShell>;
  if (!user || !data) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Gift a Reading</h1>
          <p className="mt-1 text-sm text-muted">{failed || "Purchases stay off until payment is ready. Sign in to see gift codes."}</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/login">Sign in</Link></Button>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to="/me" className="text-sm text-primary">Wallet</Link>
        <h1 className="mt-2 font-display text-3xl text-fg">Gift a Reading</h1>
        <p className="mt-1 text-sm text-muted">Real-money gift purchases are off until payment integration is finished. A code created here stays unpaid and cannot be redeemed.</p>
        <form
          className="mt-6 space-y-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
          onSubmit={(event) => {
            event.preventDefault();
            void createGiftIntent({ data: { coins, message } })
              .then((res) => {
                toast.message(res.message);
                setMessage("");
                return load();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not create a gift"));
          }}
        >
          <div className="flex flex-wrap gap-2">
            {data.denominations.map((amount) => (
              <Button key={amount} type="button" variant={coins === amount ? "default" : "outline"} onClick={() => setCoins(amount)}>{amount}c</Button>
            ))}
          </div>
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} rows={2} placeholder="A short note (optional)" />
          <Button type="submit" className="w-full rounded-full">Create unpaid gift code</Button>
        </form>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void redeemGift({ data: { code } })
              .then((res) => toast.success(`${res.coins} promo coins added.`))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not redeem"));
          }}
        >
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Gift code" aria-label="Gift code" />
          <Button type="submit" variant="outline">Redeem</Button>
        </form>
        <ul className="mt-4 space-y-2">
          {data.gifts.map((gift) => (
            <li key={gift.id} className="rounded-xl bg-surface px-4 py-3 text-sm shadow-[var(--shadow-border)]">
              <p className="font-medium tabular-nums">{gift.code}</p>
              <p className="text-xs text-faint">{gift.coins}c · {gift.status} · {formatWhen(gift.at)}</p>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
