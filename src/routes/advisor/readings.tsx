import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ADVISOR_CHIP, DeskSearch, EmptyState, FilterChips, Initials, ReminderDialog, StatusPill, orderTone } from "@/components/advisor-desk";
import { DeskHeading } from "@/components/advisor-shell";
import { ClientNameWithBadge } from "@/components/loyalty-badge";
import { Button } from "@/components/ui/button";
import { advisorOrders } from "@/lib/ora-advisor-desk";
import { decideRequest, formatWhen } from "@/lib/ora";
import { formatWait, waitingSeconds, walletBillingLabel, type OrderFilter, type WalletBillingKind } from "@/lib/ora-advisor-desk-stats";
import { formatDuration } from "@/lib/ora-advisor-auth";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import { useOraRefresh } from "@/lib/use-ora-refresh";

export const Route = createFileRoute("/advisor/readings")({ component: OrdersPage });

const FILTERS = [
  { id: "all" as const, label: "All", ...ADVISOR_CHIP.plum },
  { id: "pending" as const, label: "Pending", ...ADVISOR_CHIP.gold },
  { id: "progress" as const, label: "In progress", ...ADVISOR_CHIP.lilac },
  { id: "completed" as const, label: "Completed", ...ADVISOR_CHIP.mint },
  { id: "cancelled" as const, label: "Cancelled", ...ADVISOR_CHIP.rose },
];

function OrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [q, setQ] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof advisorOrders>> | null>(null);
  const [workingId, setWorkingId] = useState("");
  const [remindFor, setRemindFor] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    return advisorOrders({ data: { filter, q } })
      .then(setData)
      .catch(() => setData({ filter, orders: [] }));
  }, [filter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useOraRefresh(load);

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

  if (!data) {
    return (
      <main className="space-y-4">
        <DeskHeading icon={ClipboardList} title="Orders" />
        <div className="h-40 animate-pulse rounded-2xl bg-dash-note" />
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <DeskHeading icon={ClipboardList} title="Orders" />
      <DeskSearch value={q} onChange={setQ} placeholder="Search by client or order" />
      <FilterChips value={filter} onChange={setFilter} options={FILTERS} />
      {!data.orders.length ? (
        <EmptyState title="No orders" body="Incoming live text chats and finished readings will list here." />
      ) : (
        <ul className="space-y-2">
          {data.orders.map((order: any) => {
            const pending = order.bucket === "pending" && order.kind === "request";
            return (
              <li key={`${order.kind}-${order.id}`} className="rounded-2xl border border-dash-note-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Initials name={order.customerName} photo={order.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <ClientNameWithBadge name={order.customerName} tier={order.loyaltyTier} className="max-w-full text-base font-semibold" />
                        <p className="mt-0.5 text-sm text-muted">{order.service}</p>
                      </div>
                      <StatusPill tone={orderTone(order.bucket)}>{order.bucket === "progress" ? "In progress" : order.bucket}</StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-muted">{formatWhen(order.at)}</p>
                    {order.kind === "reading" && order.seconds > 0 ? (
                      <p className="mt-1 text-xs font-medium text-fg">Session {formatDuration(order.seconds)}</p>
                    ) : null}
                    {pending ? (
                      <p className="mt-2 rounded-xl border border-dash-quiet-line bg-dash-quiet px-3 py-2 text-xs leading-relaxed text-fg">
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
                        <>
                          <Button asChild variant="outline" size="sm" className="flex-1">
                            <Link to="/advisor/session/$id" params={{ id: order.readingId }} preload={false}>
                              Open conversation
                            </Link>
                          </Button>
                          {order.bucket === "completed" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setRemindFor({ id: order.customerId, name: order.customerName })}
                            >
                              Remind
                            </Button>
                          ) : null}
                        </>
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
      <ReminderDialog
        open={Boolean(remindFor)}
        name={remindFor?.name || ""}
        customerId={remindFor?.id || ""}
        onOpenChange={(open) => !open && setRemindFor(null)}
      />
    </main>
  );
}
