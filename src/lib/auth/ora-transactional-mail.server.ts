import { createAuthMiddleware } from "better-auth/api";
import { allowAuthEmailRequest, authEmailRateKey } from "./auth-email-rate.ts";
import { stabilizeResetEmailUrl, stabilizeVerificationEmailUrl } from "./ora-login.ts";

export const ORA_MAIL_FROM = "Ora <no-reply@orapsychic.com>";
export const ORA_MAIL_REPLY_TO = "support@orapsychic.com";

type Mail = { to: string; subject: string; text: string; html: string };

function clientIp(request: Request | undefined) {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request?.headers.get("x-real-ip")?.trim() || "unknown";
}

function pageOrigin(request: Request | undefined) {
  return request?.headers.get("origin") || "";
}

async function postResend(body: Mail & { to: string }) {
  const resend = process.env.RESEND_API_KEY?.trim();
  if (!resend) {
    console.error("[ora] transactional email provider is not configured");
    throw new Error("MAIL_UNAVAILABLE");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: ORA_MAIL_FROM,
      to: [body.to],
      reply_to: ORA_MAIL_REPLY_TO,
      subject: body.subject,
      text: body.text,
      html: body.html,
    }),
  });
  if (!res.ok) {
    console.error("[ora] transactional email failed", res.status);
    throw new Error("MAIL_UNAVAILABLE");
  }
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f8f6f7;color:#2a2430;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px 28px;">
        <tr><td>
          <p style="margin:0 0 8px;letter-spacing:.18em;text-transform:uppercase;font-size:12px;color:#c4a35a;">Ora</p>
          <h1 style="margin:0 0 16px;font-weight:normal;font-size:28px;color:#2a2430;">${title}</h1>
          ${body}
          <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#72687a;">Ora provides psychic entertainment. This message was sent for your account. Reply to this email if you need help.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#7a4e6c;color:#fffafc;text-decoration:none;border-radius:999px;padding:12px 22px;">${label}</a></p>
  <p style="margin:0;font-size:13px;line-height:1.5;color:#72687a;word-break:break-all;">${href}</p>`;
}

export async function sendOraPasswordReset(input: { to: string; url: string; request?: Request }) {
  const url = stabilizeResetEmailUrl(input.url, pageOrigin(input.request));
  const to = String(input.to || "").trim();
  if (!to || !url) throw new Error("MAIL_UNAVAILABLE");
  const text = [
    "Reset your Ora password:",
    url,
    "",
    "This link expires in 1 hour and works once. If you did not ask for this, you can ignore this email.",
    "",
    "Reply to support@orapsychic.com if you need help.",
  ].join("\n");
  await postResend({
    to,
    subject: "Reset your Ora password",
    text,
    html: shell(
      "Reset your password",
      `<p style="margin:0;font-size:16px;line-height:1.5;">Use the button below to choose a new password. The link expires in one hour and can be used once.</p>${button(url, "Reset password")}`,
    ),
  });
}

export async function sendOraVerificationEmail(input: { to: string; url: string; request?: Request }) {
  const url = stabilizeVerificationEmailUrl(input.url, pageOrigin(input.request));
  const to = String(input.to || "").trim();
  if (!to || !url) throw new Error("MAIL_UNAVAILABLE");
  const text = [
    "Confirm your Ora email:",
    url,
    "",
    "This link expires in 1 hour. If you did not create an Ora account, you can ignore this email.",
  ].join("\n");
  await postResend({
    to,
    subject: "Confirm your Ora email",
    text,
    html: shell(
      "Confirm your email",
      `<p style="margin:0;font-size:16px;line-height:1.5;">Confirm this address so Ora knows it is yours. You can keep using your account either way.</p>${button(url, "Confirm email")}`,
    ),
  });
}

/** Stops extra reset and verification sends without saying whether the address exists. */
export const oraAuthEmailHooks = {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/request-password-reset" && ctx.path !== "/send-verification-email") return;
    const body = ctx.body as { email?: unknown } | undefined;
    const email = typeof body?.email === "string" ? body.email : "";
    const key = authEmailRateKey(ctx.path, clientIp(ctx.request), email);
    if (!allowAuthEmailRequest(key)) return { status: true };
  }),
};
