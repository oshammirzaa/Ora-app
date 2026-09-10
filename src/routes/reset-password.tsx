import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { authClient, authEnabled } from "@/lib/auth/client";

export const Route = createFileRoute("/reset-password")({ component: Reset });

function Reset() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }
    setBusy(true);
    try {
      const client = authClient as typeof authClient & {
        resetPassword?: (opts: { newPassword: string; token: string }) => Promise<{ error?: { message?: string } }>;
      };
      if (!client.resetPassword) throw new Error("Reset is not available. Sign in and change your password in Settings.");
      const { error: err } = await client.resetPassword({ newPassword: password, token });
      if (err) throw new Error(err.message || "Could not reset password");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Reset password" subtitle="Choose a new password for this account.">
      {authEnabled ? (
        done ? (
          <p className="text-sm text-ok">
            Password updated.{" "}
            <Link to="/login" className="text-primary">
              Sign in
            </Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <PasswordField id="pw" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordField id="pw2" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </form>
        )
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
    </AuthFrame>
  );
}
