import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EmptyNote, PageHeader, Stat } from "@/components/admin-shell";
import { formatWhen } from "@/lib/ora";
import { adminIpSecurity } from "@/lib/ora-ip-security-api";

export const Route = createFileRoute("/admin/ip-security")({ component: IpSecurityPage });

type SecurityData = Awaited<ReturnType<typeof adminIpSecurity>>;

function IpSecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);

  useEffect(() => {
    void adminIpSecurity()
      .then(setData)
      .catch(() => setData({ rows: [], clusters: [] }));
  }, []);

  const rows = data?.rows ?? [];
  const clusters = data?.clusters ?? [];

  return (
    <main>
      <PageHeader
        kicker="Owner"
        title="IP Security"
        description="Advisor sign-in addresses for manual review. A shared IP can be a household, office, mobile carrier, VPN, or public network. This page does not suspend, ban, block, or change ranking."
      />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Advisors" value={String(rows.length)} />
        <Stat label="Potential shared IPs" value={String(clusters.length)} tone={clusters.length ? "warn" : "ok"} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Potential Shared IP</h2>
        <p className="mt-1 text-sm text-muted">Multiple accounts detected on the same public IP. Review only. Shared networks are often legitimate.</p>
        <ul className="mt-4 space-y-3">
          {!data ? (
            <li>
              <EmptyNote>Loading sign-in records.</EmptyNote>
            </li>
          ) : !clusters.length ? (
            <li>
              <EmptyNote>No duplicate detected.</EmptyNote>
            </li>
          ) : (
            clusters.map((cluster) => (
              <li key={cluster.ip} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <p className="font-medium">Potential Shared IP</p>
                <p className="mt-1 text-sm text-muted">Multiple Accounts Detected on Same IP</p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">IP Address</dt>
                    <dd className="mt-0.5 font-medium">{cluster.ip}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Accounts detected</dt>
                    <dd className="mt-0.5">{cluster.accountsDetected}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">First detected</dt>
                    <dd className="mt-0.5">{formatWhen(cluster.firstDetected) || cluster.firstDetected}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Most recent</dt>
                    <dd className="mt-0.5">{formatWhen(cluster.lastDetected) || cluster.lastDetected}</dd>
                  </div>
                </dl>
                <ul className="mt-4 space-y-3">
                  {cluster.accounts.map((account, index) => (
                    <li key={account.advisorId} className="rounded-xl bg-elevated p-3">
                      <p className="text-sm font-medium">Advisor {index + 1}</p>
                      <p className="mt-1 text-sm">{account.name}</p>
                      <p className="text-sm text-muted">{account.email || "No email"}</p>
                      <p className="mt-1 text-xs text-faint">Advisor ID {account.advisorId}</p>
                      <p className="text-xs text-faint">Last login {formatWhen(account.lastLogin) || account.lastLogin}</p>
                      <p className="text-xs text-faint">{account.device}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Advisor sign-ins</h2>
        <ul className="mt-4 space-y-3">
          {!rows.length ? (
            <li>
              <EmptyNote>{data ? "No advisor sign-ins recorded yet." : "Loading sign-in records."}</EmptyNote>
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.advisorId} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{row.name}</p>
                  <span className={row.status === "Potential Shared IP" ? "text-xs text-warn" : "text-xs text-ok"}>
                    {row.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Email</dt>
                    <dd className="mt-0.5 break-all">{row.email || "No email"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">IP Address</dt>
                    <dd className="mt-0.5">{row.ip}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Last Login</dt>
                    <dd className="mt-0.5">{formatWhen(row.lastLogin) || row.lastLogin}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Device</dt>
                    <dd className="mt-0.5">{row.device}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Accounts on this IP</dt>
                    <dd className="mt-0.5">{row.accountsOnIp}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-faint uppercase">Last seen</dt>
                    <dd className="mt-0.5">{formatWhen(row.lastSeen) || row.lastSeen}</dd>
                  </div>
                </dl>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
