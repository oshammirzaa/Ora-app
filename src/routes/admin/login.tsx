import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField, SocialSignIn } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { bootstrapOwner } from "@/lib/ora-owner";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await bootstrapOwner({ data: { email, password } });
      const { error: err } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/admin",
      });
      if (err) throw new Error(err.message || "Could not sign in");
      window.location.assign("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Owner sign in"
      subtitle="Assigned owner accounts only. Customer and psychic sign-ups never receive this access automatically."
    >
      {authEnabled ? (
        <>
          <SocialSignIn callbackURL="/admin" />
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
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to owner panel"}
            </Button>
          </form>
          <p className="text-sm text-faint">
            Customer?{" "}
            <Link to="/login" className="text-primary">
              Sign in for a reading
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
    </AuthFrame>
  );
}
