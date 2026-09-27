/**
 * Local email/password on this app's Better Auth database.
 *
 * Password reset uses Better Auth's official single-use token. Delivery failures
 * are swallowed here so the HTTP result stays the same for known and unknown emails.
 */
import { sendOraPasswordReset } from "./password-reset-mail.server.ts";

export const emailAndPasswordEnabled = true;

export const emailAndPassword = {
  enabled: true,
  revokeSessionsOnPasswordReset: true,
  resetPasswordTokenExpiresIn: 60 * 60,
  sendResetPassword: async ({
    user,
    url,
  }: {
    user: { email: string };
    url: string;
    token: string;
  }) => {
    try {
      await sendOraPasswordReset({ to: user.email, url });
    } catch {
      console.error("[ora] password reset email was not delivered");
    }
  },
};
