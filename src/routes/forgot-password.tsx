import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { passwordResetRedirect, RESET_SENT_MESSAGE } from "@/lib/auth/ora-login";

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
        requestPasswordReset: (opts: { email: string; redirectTo: string }) => Promise<unknown>;
      };
      await client.requestPasswordReset({
        email,
        redirectTo: passwordResetRedirect(window.location.origin),
      });
    } catch {
      /* Same response whether or not the email is registered. */
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <AuthFrame lockup title="Forgot password" subtitle="Works for customer and advisor accounts.">
      {authEnabled ? (
        sent ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-surface p-4 text-sm text-muted shadow-[var(--shadow-border)]">{RESET_SENT_MESSAGE}</p>
            <p className="text-sm text-muted">
              <Link to="/login" className="text-primary">
                Customer Login
              </Link>
              {" · "}
              <Link to="/advisor/login" className="text-primary">
                Advisor Login
              </Link>
            </p>
          </div>
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
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
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
          Customer Login
        </Link>
      </p>
    </AuthFrame>
  );
}
