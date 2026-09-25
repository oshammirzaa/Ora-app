import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthFrame, PasswordField, SocialSignIn } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmAdultAge } from "@/lib/ora-compliance-api";
import { authClient, authEnabled } from "@/lib/auth/client";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!terms) {
      setError("Accept the terms to create an account.");
      return;
    }
    if (!adult) {
      setError("Confirm that you are 18 or older.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.signUp.email({
        email,
        password,
        name: name.trim(),
        callbackURL: "/me",
      });
      if (err) throw new Error(err.message || "Could not create account");
      try {
        await confirmAdultAge();
      } catch {
        /* stored on the next signed-in visit if the session is not ready yet */
        sessionStorage.setItem("ora-age-ok", "1");
      }
      window.location.assign("/me");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame lockup title="Create account" subtitle="First login gifts three free minutes. Then $10 a week, or coins.">
      {authEnabled ? (
        <>
          <label className="flex items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="mt-1 size-4 accent-primary"
              required
            />
            <span>I confirm that I am 18 years of age or older.</span>
          </label>
          <SocialSignIn
            beforeSignIn={() => {
              if (!adult) {
                setError("Confirm that you are 18 or older.");
                return false;
              }
              sessionStorage.setItem("ora-age-ok", "1");
              return true;
            }}
          />
          <p className="text-center text-xs tracking-wide text-faint uppercase">or email</p>
          <form onSubmit={onSubmit} method="post" action="/signup" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
              />
            </div>
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
              autoComplete="new-password"
            />
            <PasswordField
              id="pw2"
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                I accept the{" "}
                <Link to="/terms" className="text-primary hover:text-fg">
                  terms of use
                </Link>
                . Readings are for entertainment.
              </span>
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full rounded-full" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:text-fg">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-up is disabled.</p>
      )}
    </AuthFrame>
  );
}
