import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";

export const Route = createFileRoute("/forgot-password")({ component: Forgot });

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const client = authClient as typeof authClient & {
        requestPasswordReset?: (opts: { email: string; redirectTo: string }) => Promise<unknown>;
        forgetPassword?: (opts: { email: string; redirectTo: string }) => Promise<unknown>;
      };
      const redirectTo = `${window.location.origin}/reset-password`;
      if (client.requestPasswordReset) {
        await client.requestPasswordReset({ email, redirectTo });
      } else if (client.forgetPassword) {
        await client.forgetPassword({ email, redirectTo });
      }
    } catch {
      /* Always show the same result so we never leak whether the email exists. */
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Forgot password" subtitle="Enter the email on your account. If it is on file, we send reset instructions.">
      {authEnabled ? (
        sent ? (
          <p className="rounded-xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">
            If an account exists for {email}, check that inbox for a reset link. Then{" "}
            <Link to="/login" className="text-primary">
              sign in
            </Link>
            .
          </p>
        ) : (
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
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
      <p className="text-sm text-muted">
        Remembered it?{" "}
        <Link to="/login" className="text-primary hover:text-fg">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
