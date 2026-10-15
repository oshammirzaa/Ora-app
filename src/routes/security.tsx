import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { beginTotp, confirmTotp, disableTotp, revokeOtherSessions, securityOverview } from "@/lib/ora-advanced-api";
import { formatWhen } from "@/lib/ora";

export const Route = createFileRoute("/security")({ component: SecurityCentre });

function SecurityCentre() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<Awaited<ReturnType<typeof securityOverview>> | null>(null);
  const [failed, setFailed] = useState("");
  const [setup, setSetup] = useState("");
  const [code, setCode] = useState("");

  async function load() {
    setData(await securityOverview());
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => setFailed(err instanceof Error ? err.message : "Could not load security"));
  }, [user]);

  if (isPending || (user && !data && !failed)) return <AppShell tab="you"><div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" /></AppShell>;
  if (!user || !data) {
    return (
      <AppShell tab="you">
        <main className="px-4 py-8">
          <h1 className="font-display text-3xl text-fg">Login & Security</h1>
          <p className="mt-1 text-sm text-muted">{failed || "Devices, sessions, and an optional authenticator. Sign in to review this account."}</p>
          <Button asChild className="mt-4 rounded-full"><Link to="/login">Sign in</Link></Button>
        </main>
      </AppShell>
    );
  }

  const advisor = data.role === "advisor";

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <Link to={advisor ? "/advisor/settings" : "/me"} className="text-sm text-primary">Back</Link>
        <h1 className="mt-2 font-display text-3xl text-fg">Login & Security</h1>
        <p className="mt-1 text-sm text-muted">Passwords and session tokens stay hidden. Sign-in itself is unchanged. The authenticator is optional and is not required to log in.</p>
        <p className="mt-4 text-sm">
          <Link to={advisor ? "/advisor/settings/security" : "/me"} hash={advisor ? undefined : "profile-photo"} className="text-primary">Change password</Link>
        </p>
        <section className="mt-6 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl">Active sessions</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => void revokeOtherSessions({ data: { code } }).then((res) => { toast.success(`Signed out of ${res.revoked} other device${res.revoked === 1 ? "" : "s"}.`); return load(); }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not sign out"))}>Sign out others</Button>
          </div>
          <ul className="mt-3 space-y-2">
            {data.sessions.map((session) => (
              <li key={session.id} className="rounded-xl bg-elevated px-3 py-2 text-sm">
                <p>{session.device}{session.current ? " · this device" : ""}</p>
                <p className="text-xs text-faint">{session.ip || "IP hidden"} · {formatWhen(session.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Authenticator</h2>
          <p className="mt-1 text-sm text-muted">{data.totpEnabled ? "On for sensitive actions on this page." : "Off. Turning it on does not change how you sign in."}</p>
          {setup ? <p className="mt-2 break-all text-xs text-faint">{setup}</p> : null}
          <div className="mt-3 flex gap-2">
            <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" placeholder="6-digit code" aria-label="Authenticator code" />
            {data.totpEnabled ? (
              <Button type="button" variant="outline" onClick={() => void disableTotp({ data: { code } }).then(() => { setCode(""); toast.success("Authenticator removed."); return load(); }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not disable"))}>Turn off</Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => {
                if (!setup) {
                  void beginTotp().then((res) => setSetup(res.otpauth)).catch((err) => toast.error(err instanceof Error ? err.message : "Could not start"));
                  return;
                }
                void confirmTotp({ data: { code } }).then(() => { setSetup(""); setCode(""); toast.success("Authenticator on."); return load(); }).catch((err) => toast.error(err instanceof Error ? err.message : "Code did not match"));
              }}>{setup ? "Confirm" : "Set up"}</Button>
            )}
          </div>
        </section>
        <section className="mt-4">
          <h2 className="font-display text-xl">Recent activity</h2>
          <ul className="mt-2 space-y-2">
            {data.events.map((event) => (
              <li key={event.id} className="rounded-xl bg-surface px-4 py-3 text-sm shadow-[var(--shadow-border)]">
                <p>{event.detail || event.kind}</p>
                <p className="text-xs text-faint">{event.device} · {formatWhen(event.at)}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
