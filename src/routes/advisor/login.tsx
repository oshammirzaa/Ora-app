import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField, SocialSignIn } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { loginDestination, publicCredentialMessage } from "@/lib/auth/ora-login";
import { loginHrefForRole } from "@/lib/ora-home-route";
import { advisorEntryState } from "@/lib/ora-advisor";

export const Route = createFileRoute("/advisor/login")({ component: AdvisorLogin });

async function waitForSession() {
  for (let i = 0; i < 25; i += 1) {
    const { data } = await authClient.getSession();
    if (data?.user) return data.user;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

function AdvisorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setKind("");
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) throw new Error(err.message || "Could not sign in");
      const user = await waitForSession();
      if (!user) throw new Error("Could not sign in");
      const entry = await advisorEntryState();
      const dest = loginDestination("advisor", entry.kind, entry.role);
      if (!dest.href) {
        setKind(entry.kind);
        setError(dest.notice);
        return;
      }
      window.location.assign(loginHrefForRole(dest.href, { role: entry.role, hostname: window.location.hostname }));
    } catch (err) {
      setError(publicCredentialMessage(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame lockup title="Advisor Login" subtitle="Same Ora account. Approved advisors open the desk.">
      {authEnabled ? (
        <>
          <SocialSignIn callbackURL="/advisor" />
          <p className="text-center text-xs tracking-wide text-faint uppercase">or email</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <PasswordField id="pw" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary">
                Forgot password
              </Link>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {kind === "declined" || kind === "rejected" ? (
              <Button asChild variant="outline" className="w-full">
                <Link to="/advisor/signup">Apply again</Link>
              </Button>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Advisor Login"}
            </Button>
          </form>
          <p className="text-sm text-muted">
            New advisor?{" "}
            <Link to="/advisor/signup" className="text-primary">
              Apply as Advisor
            </Link>
          </p>
          <p className="text-sm text-faint">
            Looking for a reading?{" "}
            <Link to="/login" className="text-primary">
              Customer Login
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
    </AuthFrame>
  );
}
