import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { InfoNote, PageHeader, Stat } from "@/components/admin-shell";
import { PrivateReadingsDesk } from "@/components/admin-private-reading";
import { adminPrivateReadings } from "@/lib/ora-private-readings-api";

export const Route = createFileRoute("/admin/private-readings")({ component: PrivateReadingsPage });

function PrivateReadingsPage() {
  const [stats, setStats] = useState({ total: 0, free: 0, paid: 0, mixed: 0, live: 0, coins: 0 });

  useEffect(() => {
    void adminPrivateReadings({ data: { page: 1 } })
      .then((result) => setStats(result.stats))
      .catch(() => undefined);
  }, []);

  return (
    <main>
      <PageHeader
        icon={Lock}
        title="Private Readings"
        description="Stored conversations between a customer and an advisor. PDFs are encrypted copies, not a second transcript."
      />
      <InfoNote>
        Only an administrator with private-reading permission can open a transcript or PDF. Coins and minutes are the amounts stored on the reading. Nothing on this page changes billing.
      </InfoNote>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Readings" value={String(stats.total)} hint="Full archive" tone="violet" />
        <Stat label="Free" value={String(stats.free)} hint="No coins charged" tone="mint" />
        <Stat label="Paid" value={String(stats.paid)} hint="Coins charged, no included time" tone="sand" />
        <Stat label="Mixed" value={String(stats.mixed)} hint="Included time and coins" tone="sky" />
        <Stat label="Live" value={String(stats.live)} hint="Still open" tone="rose" />
        <Stat label="Coins charged" value={`${stats.coins}c`} hint="Stored coins, not estimated" tone="teal" />
      </div>
      <PrivateReadingsDesk />
    </main>
  );
}
