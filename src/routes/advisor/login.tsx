import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField, SocialSignIn } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";

export const Route = createFileRoute("/advisor/login")({ component: AdvisorLogin });

function AdvisorLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/advisor",
      });
      if (err) throw new Error(err.message || "Could not sign in");
      window.location.assign("/advisor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Advisor sign in" subtitle="Desk, incoming chats, and payouts. Separate from the customer account.">
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to desk"}
            </Button>
          </form>
          <p className="text-sm text-muted">
            New advisor?{" "}
            <Link to="/advisor/signup" className="text-primary">
              Apply and create an account
            </Link>
          </p>
          <p className="text-sm text-faint">
            Looking for a reading?{" "}
            <Link to="/login" className="text-primary">
              Customer sign in
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
    </AuthFrame>
  );
}
