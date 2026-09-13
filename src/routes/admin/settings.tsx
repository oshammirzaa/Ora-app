import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLATFORM_SHARE_MAX, type SiteSettings } from "@/lib/ora";
import { adminSaveSettings, adminSettings } from "@/lib/ora-admin";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const [form, setForm] = useState<SiteSettings | null>(null);

  useEffect(() => {
    void adminSettings({ data: { t: Date.now() } })
      .then(setForm)
      .catch(() => setForm(null));
  }, []);

  if (!form) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  return (
    <main>
      <PageHeader
        title="Settings"
        description="Marketplace identity, house commission, payout rules, and currency. Billing reads these on the server."
      />
      <form
        className="mt-6 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          void adminSaveSettings({ data: form })
            .then((next) => {
              setForm(next);
              toast.success("Settings saved.");
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
        }}
      >
        <Panel title="Marketplace">
          <div className="space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="space-y-1.5">
              <Label htmlFor="mname">Marketplace name</Label>
              <Input id="mname" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logo">Logo URL</Label>
              <Input id="logo" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="/favicon.svg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semail">Support email</Label>
              <Input id="semail" type="email" value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cur">Currency</Label>
              <Input id="cur" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
            </div>
          </div>
        </Panel>

        <Panel title="Commission">
          <div className="space-y-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <div className="space-y-1.5">
              <Label htmlFor="comm">House commission %</Label>
              <Input
                id="comm"
                type="number"
                min={0}
                max={PLATFORM_SHARE_MAX}
                value={form.platformShare}
                onChange={(e) => set("platformShare", Number(e.target.value))}
              />
              <p className="text-xs text-faint">
                Advisors keep {100 - form.platformShare}% of paid coins. House default is 80%. Applied on the next sitting.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Payout rules">
          <div className="grid gap-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="minp">Minimum payout (coins)</Label>
              <Input
                id="minp"
                type="number"
                min={1}
                value={form.minPayoutCoins}
                onChange={(e) => set("minPayoutCoins", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hold">Earnings hold (hours)</Label>
              <Input
                id="hold"
                type="number"
                min={0}
                max={168}
                value={form.payoutHoldHours}
                onChange={(e) => set("payoutHoldHours", Number(e.target.value))}
              />
              <p className="text-xs text-faint">0 releases advisor earnings immediately after a sitting.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Promotional included minutes">
          <div className="grid gap-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="welcome">First-sign-in included minutes</Label>
              <Input
                id="welcome"
                type="number"
                min={0}
                max={30}
                value={Math.round(form.welcomeSeconds / 60)}
                onChange={(e) => set("welcomeSeconds", Math.max(0, Math.floor(Number(e.target.value) || 0) * 60))}
              />
              <p className="text-xs text-faint">Applied to new customer wallets. Currently {form.welcomeSeconds}s.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weekly">Weekly included minutes</Label>
              <Input
                id="weekly"
                type="number"
                min={0}
                max={30}
                value={Math.round(form.weeklySeconds / 60)}
                onChange={(e) => set("weeklySeconds", Math.max(0, Math.floor(Number(e.target.value) || 0) * 60))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wcoins">Welcome coins</Label>
              <Input
                id="wcoins"
                type="number"
                min={0}
                max={500}
                value={form.welcomeCoins}
                onChange={(e) => set("welcomeCoins", Number(e.target.value))}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Owner notes">
          <div className="rounded-xl bg-surface p-5 text-sm text-muted shadow-[var(--shadow-border)]">
            Payment provider keys, database URLs, and other environment secrets are not shown here. Configure those on
            the host, not in this panel.
          </div>
        </Panel>

        <Button type="submit">Save settings</Button>
      </form>
    </main>
  );
}