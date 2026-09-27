import { stabilizeResetEmailUrl } from "./ora-login.ts";

type ResetMail = { to: string; url: string };

function fromAddress() {
  return process.env.AUTH_EMAIL_FROM?.trim() || "Ora Psychic <noreply@orapsychic.com>";
}

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[ora] password reset email failed", res.status);
    throw new Error("RESET_MAIL_UNAVAILABLE");
  }
}

/** Official Better Auth reset hook. The token stays in Better Auth; this only delivers the link. */
export async function sendOraPasswordReset(input: ResetMail) {
  const url = stabilizeResetEmailUrl(input.url);
  const to = String(input.to || "").trim();
  if (!to || !url) throw new Error("RESET_MAIL_UNAVAILABLE");
  const text = [
    "Reset your Ora password:",
    url,
    "",
    "This link expires in 1 hour and works once. If you did not ask for this, you can ignore this email.",
  ].join("\n");
  const subject = "Reset your Ora password";
  const resend = process.env.RESEND_API_KEY?.trim();
  if (resend) {
    await postJson("https://api.resend.com/emails", { authorization: `Bearer ${resend}` }, {
      from: fromAddress(),
      to: [to],
      subject,
      text,
    });
    return;
  }
  const sendgrid = process.env.SENDGRID_API_KEY?.trim();
  if (sendgrid) {
    await postJson("https://api.sendgrid.com/v3/mail/send", { authorization: `Bearer ${sendgrid}` }, {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromAddress().match(/<([^>]+)>/)?.[1] || "noreply@orapsychic.com" },
      subject,
      content: [{ type: "text/plain", value: text }],
    });
    return;
  }
  const postmark = process.env.POSTMARK_SERVER_TOKEN?.trim();
  if (postmark) {
    await postJson("https://api.postmarkapp.com/email", { "X-Postmark-Server-Token": postmark }, {
      From: fromAddress().match(/<([^>]+)>/)?.[1] || "noreply@orapsychic.com",
      To: to,
      Subject: subject,
      TextBody: text,
    });
    return;
  }
  console.error("[ora] password reset email provider is not configured");
  throw new Error("RESET_MAIL_UNAVAILABLE");
}
