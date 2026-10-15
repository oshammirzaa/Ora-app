import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminAdvancedBoard, adminGiftAction, adminReverseReferral, saveAdvancedSetting } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/admin/advanced")({ component: AdvancedAdmin });

function AdvancedAdmin() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminAdvancedBoard>> | null>(null);
  const [failed, setFailed] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  async function load() {
    setData(await adminAdvancedBoard());
  }

  useEffect(() => {
    void load().catch((err) => setFailed(err instanceof Error ? err.message : "Could not load"));
  }, []);

  if (!data && !failed) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!data) return <main><h1 className="font-display text-3xl">Advanced</h1><p className="mt-2 text-sm text-muted">{failed}</p></main>;
  if (!data.enabled) return <main><h1 className="font-display text-3xl">Advanced</h1><p className="mt-2 text-sm text-muted">These tools are switched off in this environment.</p></main>;

  return (
    <main className="space-y-6">
      <h1 className="font-display text-3xl">Advanced</h1>
      <p className="text-sm text-muted">Flags on in this preview only. Payments, commission, and live chat billing are unchanged.</p>
      {data.flags.schedule ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Scheduled readings</h2>
          <p className="text-sm text-muted">Cancel window {data.bookingPolicy.cancelHours}h · lead {data.bookingPolicy.leadMinutes} min · reminders 60 and 15. In-app only.</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => void saveAdvancedSetting({ data: { key: "bookings", value: { enabled: !data.bookingPolicy.enabled } } }).then(load)}>
            {data.bookingPolicy.enabled ? "Disable booking" : "Enable booking"}
          </Button>
          <ul className="mt-3 space-y-1 text-sm">
            {data.bookings.map((row) => <li key={row.id}>{row.customer} · {row.advisor} · {row.status} · {formatWhen(row.startAt)}</li>)}
          </ul>
        </section>
      ) : null}
      {data.flags.rewards ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Daily rewards</h2>
          <p className="text-sm text-muted">{data.rewards.enabled ? "On" : "Off"} · {data.rewards.rewards.join(", ")} promo coins · {data.rewards.cooldownHours}h · max {data.rewards.maxAccountsPerIp} accounts per network.</p>
          <p className="text-sm text-muted">{data.suspicious.length} network{data.suspicious.length === 1 ? "" : "s"} with more than one claim today.</p>
          <Button size="sm" variant="outline" onClick={() => void saveAdvancedSetting({ data: { key: "rewards", value: { enabled: !data.rewards.enabled } } }).then(load)}>
            {data.rewards.enabled ? "Disable rewards" : "Enable rewards"}
          </Button>
        </section>
      ) : null}
      {data.flags.referrals ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Referrals</h2>
          <p className="text-sm text-muted">{data.referrals.referrerCoins} / {data.referrals.referredCoins} promo coins after a paid reading.</p>
          <Button size="sm" variant="outline" onClick={() => void saveAdvancedSetting({ data: { key: "referrals", value: { enabled: !data.referrals.enabled } } }).then(load)}>
            {data.referrals.enabled ? "Disable programme" : "Enable programme"}
          </Button>
          <ul className="mt-2 space-y-1 text-sm">
            {data.referralRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span>{row.status} · {row.coins}c · {formatWhen(row.at)}</span>
                {row.status === "completed" ? <Button size="sm" variant="ghost" onClick={() => void adminReverseReferral({ data: { id: row.id } }).then(load)}>Reverse</Button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.flags.gifts ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Gift credits</h2>
          <p className="text-sm text-muted">Customer purchases are disabled. Marking paid requires a payment reference and does not charge a card.</p>
          <Input value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} placeholder="Payment reference" aria-label="Payment reference" />
          <ul className="mt-2 space-y-2 text-sm">
            {data.giftRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{row.code} · {row.coins}c · {row.status}</span>
                <span className="flex gap-1">
                  {row.status === "unpaid" ? <Button size="sm" variant="outline" onClick={() => void adminGiftAction({ data: { id: row.id, status: "paid", paymentRef } }).then(load).catch((err) => toast.error(err instanceof Error ? err.message : "Could not update"))}>Mark paid</Button> : null}
                  <Button size="sm" variant="ghost" onClick={() => void adminGiftAction({ data: { id: row.id, status: "cancelled", paymentRef: "" } }).then(load)}>Cancel</Button>
                  <Button size="sm" variant="ghost" onClick={() => void adminGiftAction({ data: { id: row.id, status: "expired", paymentRef: "" } }).then(load)}>Expire</Button>
                  <Button size="sm" variant="ghost" onClick={() => void adminGiftAction({ data: { id: row.id, status: "refunded", paymentRef: "" } }).then(load)}>Refund</Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.flags.performance ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Advisor performance</h2>
          <p className="text-sm text-muted">Private. Not used for commission.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.scores.map((row) => <li key={row.id}>{row.name} · {row.score == null ? `sample ${row.sample}` : row.score} · missed {row.missed}</li>)}
          </ul>
        </section>
      ) : null}
      <section className="rounded-2xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">
        <p>Security events in 24h: {data.securityEvents}. Chat recoveries in 24h: {data.recoveryEvents}.</p>
        <p className="mt-1">Favourite-online cooldown: {data.alertCooldownHours}h. Push notifications are not connected; alerts stay in the app.</p>
        {data.flags.onlineAlerts ? (
          <Button className="mt-2" size="sm" variant="outline" onClick={() => void saveAdvancedSetting({ data: { key: "alerts", value: { cooldownHours: data.alertCooldownHours === 6 ? 12 : 6 } } }).then(load)}>
            Toggle cooldown 6h / 12h
          </Button>
        ) : null}
      </section>
    </main>
  );
}
