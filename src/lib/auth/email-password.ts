/**
 * Local email/password on this app's Better Auth database.
 *
 * Password reset uses Better Auth's official single-use token. Delivery failures
 * are swallowed here so the HTTP result stays the same for known and unknown emails.
 * Verification mail is sent on signup but does not block sign-in.
 */
import { sendOraPasswordReset, sendOraVerificationEmail } from "./ora-transactional-mail.server.ts";

export const emailAndPasswordEnabled = true;

export const emailAndPassword = {
  enabled: true,
  requireEmailVerification: false,
  revokeSessionsOnPasswordReset: true,
  resetPasswordTokenExpiresIn: 60 * 60,
  sendResetPassword: async (
    { user, url }: { user: { email: string }; url: string; token: string },
    request?: Request,
  ) => {
    try {
      await sendOraPasswordReset({ to: user.email, url, request });
    } catch {
      console.error("[ora] password reset email was not delivered");
    }
  },
};

export const emailVerification = {
  sendOnSignUp: true,
  autoSignInAfterVerification: false,
  expiresIn: 60 * 60,
  sendVerificationEmail: async (
    { user, url }: { user: { email: string }; url: string; token: string },
    request?: Request,
  ) => {
    try {
      await sendOraVerificationEmail({ to: user.email, url, request });
    } catch {
      console.error("[ora] verification email was not delivered");
    }
  },
};
