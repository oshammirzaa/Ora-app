import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { betterAuth } from "better-auth";
import { emailAndPassword } from "./email-password.ts";
import {
  loginDestination,
  PASSWORD_MIN_LENGTH,
  passwordResetRedirect,
  publicCredentialMessage,
  RESET_SENT_MESSAGE,
  resetFailureMessage,
  stabilizeResetEmailUrl,
} from "./ora-login.ts";
import { sendOraPasswordReset } from "./password-reset-mail.server.ts";
import { collectTrustedOrigins } from "./trusted-origins.ts";

const SECRET = "ora-test-secret-ora-test-secret-32";
const OLD_PASSWORD = "old-password-1";
const NEW_PASSWORD = "new-password-2";

describe("loginDestination", () => {
  it("sends a live advisor to the desk from either door and never to the customer home", () => {
    assert.deepEqual(loginDestination("advisor", "live"), { href: "/advisor", notice: "" });
    assert.deepEqual(loginDestination("customer", "live"), { href: "/advisor", notice: "" });
    assert.equal(loginDestination("advisor", "live", "advisor").href, "/advisor");
    assert.notEqual(loginDestination("advisor", "live").href, "/home");
    assert.notEqual(loginDestination("customer", "live").href, "/home");
  });

  it("sends a customer to home and an owner or admin to the existing admin panel", () => {
    assert.deepEqual(loginDestination("advisor", "none"), { href: "/home", notice: "" });
    assert.deepEqual(loginDestination("customer", "none"), { href: "/home", notice: "" });
    assert.equal(loginDestination("advisor", "none").notice.includes("invalid"), false);
    assert.equal(loginDestination("customer", "none", "admin").href, "/admin");
    assert.equal(loginDestination("advisor", "none", "owner").href, "/admin");
    assert.equal(loginDestination("customer", "none", "customer").href, "/home");
  });

  it("keeps real account-status blocks", () => {
    assert.equal(loginDestination("advisor", "pending").href, "/advisor/applied");
    assert.equal(loginDestination("customer", "pending").href, "/advisor/applied");
    assert.match(loginDestination("advisor", "paused").notice, /paused/);
    assert.equal(loginDestination("advisor", "paused").href, "");
    assert.match(loginDestination("advisor", "rejected").notice, /rejected/);
    assert.match(loginDestination("customer", "suspended").notice, /suspended/);
    assert.equal(loginDestination("customer", "declined").href, "/home");
  });
});

describe("credential copy", () => {
  it("uses a neutral wrong-password message and does not echo origin failures as invalid accounts", () => {
    assert.equal(publicCredentialMessage("Invalid email or password"), "Invalid email or password.");
    assert.equal(publicCredentialMessage("INVALID_EMAIL_OR_PASSWORD"), "Invalid email or password.");
    assert.equal(publicCredentialMessage("Invalid origin"), "Could not sign in. Try again.");
    assert.equal(publicCredentialMessage("This account is suspended."), "This account is suspended.");
  });

  it("uses the exact forgot-password sentence", () => {
    assert.equal(
      RESET_SENT_MESSAGE,
      "If an account exists for this email, we've sent password reset instructions.",
    );
    assert.equal(PASSWORD_MIN_LENGTH, 8);
    assert.match(resetFailureMessage("INVALID_TOKEN"), /invalid or expired/);
  });
});

describe("password reset urls", () => {
  it("keeps both live domains and never a preview or expired host", () => {
    assert.equal(passwordResetRedirect("https://orapsychic.com"), "https://orapsychic.com/reset-password");
    assert.equal(passwordResetRedirect("https://www.orapsychic.com"), "https://orapsychic.com/reset-password");
    assert.equal(passwordResetRedirect("https://orapsychic.xyz/login"), "https://orapsychic.xyz/reset-password");
    assert.equal(passwordResetRedirect("https://www.orapsychic.xyz"), "https://orapsychic.xyz/reset-password");
    assert.equal(passwordResetRedirect("http://localhost:8080"), "http://localhost:8080/reset-password");
    assert.equal(
      passwordResetRedirect("https://ora-app-sigma-git-expired.vercel.app"),
      "https://orapsychic.xyz/reset-password",
    );
  });

  it("rewrites Better Auth links that point at a preview host", () => {
    const raw =
      "https://ora-app-abc123.vercel.app/api/auth/reset-password/tok_123?callbackURL=" +
      encodeURIComponent("https://ora-app-abc123.vercel.app/reset-password");
    const stable = new URL(stabilizeResetEmailUrl(raw));
    assert.equal(stable.origin, "https://orapsychic.xyz");
    assert.equal(stable.pathname, "/api/auth/reset-password/tok_123");
    assert.equal(stable.searchParams.get("callbackURL"), "https://orapsychic.xyz/reset-password");
    assert.equal(stable.toString().includes(OLD_PASSWORD), false);
  });

  it("leaves a live domain link on that domain", () => {
    const raw =
      "https://orapsychic.com/api/auth/reset-password/tok_123?callbackURL=" +
      encodeURIComponent("https://orapsychic.com/reset-password");
    const stable = new URL(stabilizeResetEmailUrl(raw));
    assert.equal(stable.origin, "https://orapsychic.com");
    assert.equal(stable.searchParams.get("callbackURL"), "https://orapsychic.com/reset-password");
  });
});

describe("trusted production origins", () => {
  it("trusts orapsychic.xyz even when BETTER_AUTH_URL is orapsychic.com", () => {
    const origins = collectTrustedOrigins({
      betterAuthUrl: "https://orapsychic.com",
      includeLocalDev: false,
    });
    assert.ok(origins.includes("https://orapsychic.com"));
    assert.ok(origins.includes("https://orapsychic.xyz"));
    assert.ok(origins.includes("https://www.orapsychic.com"));
    assert.ok(origins.includes("https://www.orapsychic.xyz"));
  });
});

describe("password reset mail", () => {
  const envKeys = ["RESEND_API_KEY", "SENDGRID_API_KEY", "POSTMARK_SERVER_TOKEN", "AUTH_EMAIL_FROM"] as const;
  const saved: Record<string, string | undefined> = {};
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs: string[] = [];

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] == null) delete process.env[key];
      else process.env[key] = saved[key];
    }
    globalThis.fetch = originalFetch;
    console.error = originalError;
    logs.length = 0;
  });

  function silence() {
    for (const key of envKeys) saved[key] = process.env[key];
    for (const key of envKeys) delete process.env[key];
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
  }

  it("does not log the address or password when no provider is configured", async () => {
    silence();
    const url = stabilizeResetEmailUrl(
      "https://preview.vercel.app/api/auth/reset-password/tok_secret?callbackURL=" +
        encodeURIComponent("https://preview.vercel.app/reset-password"),
    );
    await assert.rejects(
      () => sendOraPasswordReset({ to: "person@example.com", url }),
      /RESET_MAIL_UNAVAILABLE/,
    );
    const text = logs.join("\n");
    assert.match(text, /not configured/);
    assert.equal(text.includes("person@example.com"), false);
    assert.equal(text.includes(OLD_PASSWORD), false);
    assert.equal(text.includes("tok_secret"), false);
  });

  it("sends the stabilized link and never the password", async () => {
    silence();
    process.env.RESEND_API_KEY = "test-key";
    const captured: { url: string; body: { text?: string; to?: string[] } } = { url: "", body: {} };
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      captured.url = String(url);
      captured.body = JSON.parse(String(init?.body || "{}"));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await sendOraPasswordReset({
      to: "person@example.com",
      url:
        "https://ora-app-old.vercel.app/api/auth/reset-password/tok_secret?callbackURL=" +
        encodeURIComponent("https://ora-app-old.vercel.app/reset-password"),
    });
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.deepEqual(captured.body.to, ["person@example.com"]);
    assert.match(captured.body.text || "", /https:\/\/orapsychic\.xyz\/api\/auth\/reset-password\/tok_secret/);
    assert.equal((captured.body.text || "").includes(OLD_PASSWORD), false);
    assert.equal((captured.body.text || "").includes("ora-app-old.vercel.app"), false);
  });

  it("does not throw out of the Better Auth hook when delivery is unavailable", async () => {
    silence();
    await emailAndPassword.sendResetPassword({
      user: { email: "person@example.com" },
      url: "https://preview.vercel.app/api/auth/reset-password/tok_secret?callbackURL=https%3A%2F%2Fpreview.vercel.app%2Freset-password",
      token: "tok_secret",
    });
    const text = logs.join("\n");
    assert.match(text, /was not delivered/);
    assert.equal(text.includes("person@example.com"), false);
    assert.equal(text.includes("tok_secret"), false);
  });
});

describe("better auth password reset", () => {
  async function post(
    auth: { handler: (request: Request) => Promise<Response> },
    path: string,
    body: unknown,
    origin: string,
  ) {
    const response = await auth.handler(
      new Request(`https://orapsychic.com/api/auth${path}`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json().catch(() => ({}))) as { code?: string; status?: boolean };
    return { status: response.status, json };
  }

  it("rejects orapsychic.xyz sign-in until that origin is trusted", async () => {
    const blocked = betterAuth({
      baseURL: "https://orapsychic.com",
      secret: SECRET,
      trustedOrigins: ["https://orapsychic.com"],
      emailAndPassword: { enabled: true },
    });
    const denied = await post(blocked, "/sign-in/email", { email: "nobody@example.com", password: OLD_PASSWORD }, "https://orapsychic.xyz");
    assert.equal(denied.status, 403);
    assert.equal(denied.json.code, "INVALID_ORIGIN");

    const open = betterAuth({
      baseURL: "https://orapsychic.com",
      secret: SECRET,
      trustedOrigins: ["https://orapsychic.com", "https://orapsychic.xyz", "https://www.orapsychic.com", "https://www.orapsychic.xyz"],
      emailAndPassword: { enabled: true },
    });
    const checked = await post(open, "/sign-in/email", { email: "nobody@example.com", password: OLD_PASSWORD }, "https://orapsychic.xyz");
    assert.equal(checked.status, 401);
    assert.equal(checked.json.code, "INVALID_EMAIL_OR_PASSWORD");
  });

  it("resets a password once, then accepts only the new password", async () => {
    const sent: string[] = [];
    const auth = betterAuth({
      baseURL: "https://ora-app-preview.vercel.app",
      secret: SECRET,
      trustedOrigins: ["https://orapsychic.com", "https://orapsychic.xyz", "https://ora-app-preview.vercel.app"],
      emailAndPassword: {
        enabled: true,
        revokeSessionsOnPasswordReset: true,
        resetPasswordTokenExpiresIn: 60 * 60,
        sendResetPassword: async ({ url, user }) => {
          assert.equal(JSON.stringify(user).includes(OLD_PASSWORD), false);
          sent.push(stabilizeResetEmailUrl(url));
        },
      },
    });
    const email = "customer-reset@example.com";
    const headers = new Headers({ origin: "https://orapsychic.xyz" });
    await auth.api.signUpEmail({
      body: { email, password: OLD_PASSWORD, name: "Customer" },
      headers,
    });
    const before = await auth.api.signInEmail({
      body: { email, password: OLD_PASSWORD },
      headers,
    });
    assert.equal(before.user.email, email);

    const known = await auth.api.requestPasswordReset({
      body: { email, redirectTo: "https://orapsychic.xyz/reset-password" },
      headers,
    });
    assert.equal(known.status, true);
    assert.equal(sent.length, 1);
    const link = new URL(sent[0]);
    assert.equal(link.origin, "https://orapsychic.xyz");
    assert.equal(link.searchParams.get("callbackURL"), "https://orapsychic.xyz/reset-password");
    assert.equal(link.toString().includes(OLD_PASSWORD), false);
    assert.equal(link.toString().includes("vercel.app"), false);
    const token = link.pathname.split("/").filter(Boolean).pop() || "";
    assert.ok(token);

    const unknown = await auth.api.requestPasswordReset({
      body: { email: "nobody-audit@example.com", redirectTo: "https://orapsychic.com/reset-password" },
      headers: new Headers({ origin: "https://orapsychic.com" }),
    });
    assert.equal(unknown.status, true);
    assert.equal(sent.length, 1);

    const badRedirect = await post(
      auth,
      "/request-password-reset",
      { email, redirectTo: "https://expired-deploy.vercel.app/reset-password" },
      "https://orapsychic.xyz",
    );
    assert.equal(badRedirect.status, 403);
    assert.equal(badRedirect.json.code, "INVALID_REDIRECT_URL");
    assert.equal(sent.length, 1);

    const comReset = await post(
      auth,
      "/request-password-reset",
      { email: "nobody-audit@example.com", redirectTo: "https://orapsychic.com/reset-password" },
      "https://orapsychic.com",
    );
    assert.equal(comReset.status, 200);
    assert.equal(comReset.json.status, true);

    const callback = await auth.handler(
      new Request(
        `https://ora-app-preview.vercel.app/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent("https://orapsychic.xyz/reset-password")}`,
        { method: "GET" },
      ),
    );
    assert.equal(callback.status, 302);
    const location = callback.headers.get("location") || "";
    assert.match(location, /^https:\/\/orapsychic\.xyz\/reset-password\?token=/);
    assert.equal(new URL(location).searchParams.get("token"), token);

    const reset = await auth.api.resetPassword({ body: { token, newPassword: NEW_PASSWORD } });
    assert.equal(reset.status, true);
    await assert.rejects(() => auth.api.resetPassword({ body: { token, newPassword: "another-password-3" } }));

    await assert.rejects(() =>
      auth.api.signInEmail({
        body: { email, password: OLD_PASSWORD },
        headers,
      }),
    );
    const after = await auth.api.signInEmail({
      body: { email, password: NEW_PASSWORD },
      headers,
    });
    assert.equal(after.user.email, email);
  });
});
