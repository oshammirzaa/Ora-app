import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { authClient, authEnabled } from "@/lib/auth/client";
import { PASSWORD_MIN_LENGTH, resetFailureMessage } from "@/lib/auth/ora-login";

export const Route = createFileRoute("/reset-password")({ component: Reset });

function initialResetError() {
  if (typeof window === "undefined") return "";
  const error = new URLSearchParams(window.location.search).get("error");
  if (error === "INVALID_TOKEN") return resetFailureMessage("INVALID_TOKEN");
  return "";
}

function Reset() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(initialResetError);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setError(resetFailureMessage("INVALID_TOKEN"));
      return;
    }
    setBusy(true);
    try {
      const client = authClient as typeof authClient & {
        resetPassword: (opts: { newPassword: string; token: string }) => Promise<{ error?: { message?: string } | null }>;
      };
      const { error: err } = await client.resetPassword({ newPassword: password, token });
      if (err) throw new Error(err.message || "INVALID_TOKEN");
      setDone(true);
    } catch (err) {
      setError(resetFailureMessage(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame lockup title="Reset password" subtitle="Choose a new password for this account.">
      {authEnabled ? (
        done ? (
          <div className="space-y-3 text-sm">
            <p className="text-ok">Password updated. Sign in with the new password.</p>
            <p className="text-muted">
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
            <PasswordField id="pw" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordField id="pw2" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
            <p className="text-sm text-muted">
              <Link to="/forgot-password" className="text-primary">
                Request a new link
              </Link>
            </p>
          </form>
        )
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
    </AuthFrame>
  );
}
