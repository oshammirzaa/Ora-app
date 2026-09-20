import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DeskSearch, EmptyState, FilterChips, Initials, StatusPill, orderTone } from "@/components/advisor-desk";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { advisorOrders } from "@/lib/ora-advisor-desk";
import { decideRequest, formatWhen } from "@/lib/ora";
import { formatWait, waitingSeconds, walletBillingLabel, type OrderFilter, type WalletBillingKind } from "@/lib/ora-advisor-desk-stats";
import { useVisibleInterval } from "@/lib/use-visible-interval";

export const Route = createFileRoute("/advisor/readings")({ component: OrdersPage });

const FILTERS: Array<{ id: OrderFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function OrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorOrders>> | null>(null);
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(() => {
    return advisorOrders({ data: { filter, q } })
      .then(setData)
      .catch(() => setData({ filter, orders: [] }));
  }, [filter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useVisibleInterval(() => {
    void load();
  }, 5000, Boolean(data), false);

  async function decide(id: string, accept: boolean) {
    if (workingId) return;
    setWorkingId(id);
    try {
      const res = await decideRequest({ data: { id, accept } });
      if (accept && res.readingId) {
        await navigate({ to: "/advisor/session/$id", params: { id: res.readingId } });
        return;
      }
      toast.success("Declined.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decide");
    } finally {
      setWorkingId("");
    }
  }

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main className="space-y-4">
      <DeskSearch value={q} onChange={setQ} placeholder="Search by client or order" />
      <FilterChips value={filter} onChange={setFilter} options={FILTERS} />
      {!data.orders.length ? (
        <EmptyState title="No orders" body="Incoming live text chats and finished readings will list here." />
      ) : (
        <ul className="space-y-2">
          {data.orders.map((order) => {
            const pending = order.bucket === "pending" && order.kind === "request";
            return (
              <li key={`${order.kind}-${order.id}`} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex items-start gap-3">
                  <Initials name={order.customerName} photo={order.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <ClientNameWithBadge name={order.customerName} tier={order.loyaltyTier} className="max-w-full font-medium" />
                        <p className="text-xs text-faint">{order.service}</p>
                      </div>
                      <StatusPill tone={orderTone(order.bucket)}>{order.bucket === "progress" ? "In progress" : order.bucket}</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-muted">{formatWhen(order.at)}</p>
                    {pending ? (
                      <p className="mt-1 text-xs text-muted">
                        Waiting {formatWait(waitingSeconds(order.at))}
                        {order.returning
                          ? ` · Returning · ${order.previousReadings || 0} sitting${order.previousReadings === 1 ? "" : "s"}`
                          : " · First time"}
                        {order.lastReadingAt && order.returning ? ` · last ${formatWhen(order.lastReadingAt)}` : ""}
                        {" · "}
                        {walletBillingLabel((order.billingKind as WalletBillingKind) || "none")}
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      {pending ? (
                        <>
                          <Button className="flex-1" size="sm" disabled={workingId === order.id} onClick={() => void decide(order.id, true)}>
                            Accept
                          </Button>
                          <Button variant="outline" className="flex-1" size="sm" disabled={workingId === order.id} onClick={() => void decide(order.id, false)}>
                            Decline
                          </Button>
                        </>
                      ) : order.readingId ? (
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to="/advisor/session/$id" params={{ id: order.readingId }} preload={false}>
                            Open conversation
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to="/advisor/inbox" search={{ client: order.customerId }} preload={false}>
                            Message
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
