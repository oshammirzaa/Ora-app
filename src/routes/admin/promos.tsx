import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCustomers, adminGrantPromo, adminPromos, adminSavePromo, adminSaveSettings } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/promos")({ component: PromosPage });

function PromosPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminPromos>> | null>(null);
  const [welcomeMin, setWelcomeMin] = useState("3");
  const [welcomeCoins, setWelcomeCoins] = useState("0");
  const [weeklyMin, setWeeklyMin] = useState("3");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("minutes");
  const [amount, setAmount] = useState("3");
  const [userId, setUserId] = useState("");
  const [promoId, setPromoId] = useState("");
  const [people, setPeople] = useState<Awaited<ReturnType<typeof adminCustomers>>>([]);

  async function load() {
    const next = await adminPromos({ data: { t: Date.now() } });
    setData(next);
    setWelcomeMin(String(Math.round(next.settings.welcomeSeconds / 60)));
    setWeeklyMin(String(Math.round(next.settings.weeklySeconds / 60)));
    setWelcomeCoins(String(next.settings.welcomeCoins));
    setPeople(await adminCustomers({ data: { q: "", t: Date.now() } }));
  }

  useEffect(() => {
    void load().catch(() => setData(null));
  }, []);

  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  return (
    <main>
      <h1 className="font-display text-3xl">Promotions</h1>
      <p className="mt-1 text-sm text-muted">New-user minutes, weekly included time, and named offers you can grant.</p>

      <Panel title="Default included time">
        <form
          className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            void adminSaveSettings({
              data: {
                ...data.settings,
                welcomeSeconds: Number(welcomeMin) * 60,
                weeklySeconds: Number(weeklyMin) * 60,
                welcomeCoins: Number(welcomeCoins),
              },
            })
              .then(() => {
                toast.success("Welcome offer saved.");
                return load();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="wmin">First-login minutes</Label>
              <Input id="wmin" type="number" min={0} value={welcomeMin} onChange={(e) => setWelcomeMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wcoins">Welcome coins</Label>
              <Input id="wcoins" type="number" min={0} value={welcomeCoins} onChange={(e) => setWelcomeCoins(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weekm">Weekly minutes (subscribers)</Label>
              <Input id="weekm" type="number" min={0} value={weeklyMin} onChange={(e) => setWeeklyMin(e.target.value)} />
            </div>
          </div>
          <Button type="submit">Save defaults</Button>
        </form>
      </Panel>

      <Panel title="Named offers">
        <form
          className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            void adminSavePromo({ data: { name, kind, amount: Number(amount), active: true } })
              .then(() => {
                toast.success("Offer saved.");
                setName("");
                return load();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select
                className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="minutes">Minutes</option>
                <option value="coins">Coins</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{kind === "coins" ? "Coins" : "Minutes"}</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <Button type="submit">Add offer</Button>
        </form>
        <ul className="mt-3 divide-y divide-border rounded-xl bg-surface">
          {!data.promos.length ? (
            <li className="px-4 py-3 text-sm text-muted">No named offers yet.</li>
          ) : (
            data.promos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {p.name} · {p.kind} · {p.amount} · {p.active ? "active" : "off"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void adminSavePromo({
                      data: { id: p.id, name: p.name, kind: p.kind, amount: p.amount, active: !p.active, note: p.note },
                    })
                      .then(() => load())
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update"))
                  }
                >
                  {p.active ? "Turn off" : "Turn on"}
                </Button>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Grant to a customer">
        <form
          className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            void adminGrantPromo({ data: { userId, promoId } })
              .then(() => toast.success("Granted."))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not grant"));
          }}
        >
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <select
              className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            >
              <option value="">Choose</option>
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name} {p.email ? `· ${p.email}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Offer</Label>
            <select
              className="h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)]"
              value={promoId}
              onChange={(e) => setPromoId(e.target.value)}
              required
            >
              <option value="">Choose</option>
              {data.promos.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">Grant</Button>
        </form>
      </Panel>
    </main>
  );
}