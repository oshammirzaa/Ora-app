import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField, SocialSignIn } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { loginDestination, publicCredentialMessage } from "@/lib/auth/ora-login";
import { advisorEntryState } from "@/lib/ora-advisor";

export const Route = createFileRoute("/login")({ component: Login });

async function waitForSession() {
  for (let i = 0; i < 25; i += 1) {
    const { data } = await authClient.getSession();
    if (data?.user) return data.user;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({ email, password });
      if (err) throw new Error(err.message || "Could not sign in");
      const user = await waitForSession();
      if (!user) throw new Error("Could not sign in");
      const entry = await advisorEntryState();
      const dest = loginDestination("customer", entry.kind);
      if (!dest.href) {
        setError(dest.notice);
        return;
      }
      window.location.assign(dest.href);
    } catch (err) {
      setError(publicCredentialMessage(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      lockup
      title="Customer Login"
      subtitle="Your readings, wallet, and minutes live on this account."
    >
      {authEnabled ? (
        <>
          <SocialSignIn callbackURL="/home" />
          <p className="text-center text-xs tracking-wide text-faint uppercase">or email</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <PasswordField
              id="pw"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary hover:text-fg">
                Forgot password
              </Link>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              {busy ? "Signing in…" : "Customer Login"}
            </Button>
          </form>
          <p className="text-sm text-muted">
            New here?{" "}
            <Link to="/signup" className="text-primary hover:text-fg">
              Create account
            </Link>
          </p>
          <p className="text-sm text-faint">
            Advisor?{" "}
            <Link to="/advisor/login" className="text-primary">
              Advisor Login
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
    </AuthFrame>
  );
}
