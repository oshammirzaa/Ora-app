import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { OraMark } from "@/components/ora-brand";
import { PublicFrame } from "@/components/public-frame";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { emptyMarketingPage } from "@/lib/ora-marketing-copy";

export const Route = createFileRoute("/privacy")({
  loader: async () => {
    const [host, marketing] = await Promise.all([
      loadMarketingHost().catch(() => ({ marketingHost: false })),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    return { marketingHost: host.marketingHost, supportEmail: marketing.supportEmail };
  },
  head: () => ({
    meta: [
      { title: "Privacy Policy | Ora Psychic" },
      {
        name: "description",
        content:
          "How Ora Psychic handles accounts, photos, chats, payments, notifications, and safety. Entertainment only. Not medical, legal, or financial advice.",
      },
      { property: "og:title", content: "Privacy Policy | Ora Psychic" },
      { property: "og:url", content: "https://orapsychic.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://orapsychic.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const data = Route.useLoaderData();
  const body = <PolicyBody supportEmail={data.supportEmail} />;
  if (!data.marketingHost) {
    return (
      <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
        <div className="mx-auto max-w-3xl">
          <OraMark lockup to="/" />
          <div className="mt-8">{body}</div>
        </div>
      </main>
    );
  }
  return (
    <PublicFrame marketingHost={data.marketingHost} supportEmail={data.supportEmail}>
      <main className="mx-auto max-w-3xl px-4 py-10">{body}</main>
    </PublicFrame>
  );
}

function PolicyBody({ supportEmail }: { supportEmail: string }) {
  return (
    <>
      <p className="text-xs tracking-[0.2em] text-primary uppercase">Ora Psychic</p>
      <h1 className="mt-2 font-display text-4xl text-fg md:text-5xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated September 29, 2026. You can read this page without signing in.</p>
      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted md:text-base">
        <section className="space-y-3">
          <p>
            Ora Psychic (“Ora”) runs the website at orapsychic.com and the Ora app at orapsychic.xyz. This policy describes the information Ora actually stores and why.
          </p>
          <p>
            Ora provides psychic readings for entertainment and personal reflection. Ora does not provide medical, legal, or financial advice. A reading is not a professional consultation, a diagnosis, or a promise of a particular result.
          </p>
        </section>

        <Section title="Account and profile">
          <p>When you create an account, Ora stores:</p>
          <ul>
            <li>your email address</li>
            <li>a password, stored only as a protected credential, if you use email sign-in</li>
            <li>your display name, account role, and whether the account is active</li>
            <li>optional gender, and your date of birth so Ora can confirm you are 18 or older</li>
          </ul>
          <p>
            You can also sign in with Google or X. If you do, Ora receives the account identifier and the name and email that service shares. Ora does not receive that service’s password.
          </p>
          <p>
            Advisor applications also include a legal name, phone number, country, photo, specialties, rate, and availability so Ora can review the application. Legal name, phone, email, and payout details are not published on the public website.
          </p>
        </Section>

        <Section title="Profile photos">
          <p>
            If you add a profile photo, Ora stores that image and shows it in the places the product already shows photos. A live advisor’s public photo, name, specialty, rate, rating, review count, and online status can appear on orapsychic.com. Customer photos stay inside the account and the conversation. They are not listed in the public advisor directory.
          </p>
        </Section>

        <Section title="Messages and uploaded images">
          <p>
            Ora stores live-reading and inbox messages, including text and images you upload in chat. The advisor or customer in that conversation can see them. Other customers cannot. The public site does not list private messages or customer email addresses.
          </p>
          <p>
            Where the product lets you recall a message, it is hidden from the conversation. If that message was already flagged for safety, Ora may keep a short excerpt in the safety record.
          </p>
        </Section>

        <Section title="Purchases, coins, and memberships">
          <p>
            Ora stores your coin balance, included minutes, membership plan, and payment status. When card checkout is enabled, Stripe processes the card payment. Stripe receives what it needs to complete checkout. Ora keeps the amount, currency, whether the purchase was coins or a membership, the payment status, and a payment reference. Ora does not store your full card number.
          </p>
        </Section>

        <Section title="Device and technical data">
          <p>
            Ora uses a session cookie to keep you signed in. When an advisor signs in, Ora may store the IP address, browser type, and a short device label so staff can review shared or suspicious sign-ins. Advisor presence uses a last-seen time so customers can see who is available. Ora does not run a separate advertising or analytics tracker.
          </p>
        </Section>

        <Section title="Notifications">
          <p>
            If you allow it, your browser can show a notification for a new message, an incoming live chat, or an advisor follow-up reminder. That permission stays on your device. You can turn it off in the browser. Ora does not sell notification access.
          </p>
        </Section>

        <Section title="Safety, fraud prevention, and AI">
          <p>
            Ora checks messages with its own rules for safety issues, including attempts to move a conversation off Ora, payment outside Ora, medical advice, explicit content, and accounts under 18. When a message needs more context, Ora may send a short excerpt to xAI for a safety classification. That result does not by itself suspend an account. If the classifier is unavailable, Ora still applies its own rules.
          </p>
          <p>
            Some demonstration advisors reply with automated entertainment text generated through xAI. That text is not a real person’s professional advice, and it is not medical, legal, or financial advice.
          </p>
          <p>Ora staff may review support tickets, safety reports, and advisor sign-in records to prevent fraud and abuse.</p>
        </Section>

        <Section title="Who we share information with">
          <p>Ora shares information only as needed to run the service:</p>
          <ul>
            <li>the advisor or customer in your conversation, so the reading can take place</li>
            <li>Stripe, when you pay by card</li>
            <li>Google or X, only if you choose that sign-in</li>
            <li>the email service that sends a password-reset link</li>
            <li>xAI, only for the safety excerpts and demonstration replies described above</li>
            <li>the providers that host Ora and store its database</li>
            <li>Ora staff, for support, safety, fraud review, and advisor payouts</li>
          </ul>
          <p>Ora does not sell personal information.</p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            Ora keeps account, message, photo, and purchase records while the account is open, and for as long as needed for safety, fraud prevention, disputes, and financial records.
          </p>
          <p>
            You can delete a customer account yourself. Sign in, open Account settings, and choose Delete account, or use the public page at{" "}
            <a className="text-primary" href="https://orapsychic.com/delete-account">
              orapsychic.com/delete-account
            </a>
            . Deletion asks you to confirm twice. Ora then removes the profile, photo, private messages, and sessions. Payment records are kept for 7 years. Safety records are kept for 24 months, with the message text removed. Published review text stays without your name, email, or photo.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can update your display name and profile details in your account. You can turn off browser notifications in your device settings. You can request a copy of the account information Ora holds, a correction, or deletion, through Support.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Ora is only for adults. You must be 18 or older to create an account. Ora does not knowingly collect information from children. If Ora learns that an account belongs to someone under 18, Ora closes access to readings and limits that account.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Ora protects accounts with sign-in sessions and access checks. No online service can guarantee perfect security. Use a password you do not use elsewhere, and do not share your account.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy, or a request to access or delete your data, can be sent through Support after you sign in:{" "}
            <a className="text-primary" href="https://orapsychic.com/support">
              orapsychic.com/support
            </a>
            .
          </p>
          {supportEmail ? (
            <p>
              You can also write to{" "}
              <a className="text-primary" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
          ) : (
            <p>If a support email is shown in the website footer, you can use that address as well.</p>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-fg md:text-3xl">{title}</h2>
      <div className="space-y-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
