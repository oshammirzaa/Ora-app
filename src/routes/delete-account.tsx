import { createFileRoute, Link } from "@tanstack/react-router";
import { OraMark } from "@/components/ora-brand";
import { PublicFrame } from "@/components/public-frame";
import { DeleteAccountDisclosure, DeleteAccountPanel } from "@/components/delete-account-panel";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadMarketingHost, loadPublicMarketing } from "@/lib/ora-marketing";
import { emptyMarketingPage } from "@/lib/ora-marketing-copy";

export const Route = createFileRoute("/delete-account")({
  loader: async () => {
    const [host, marketing] = await Promise.all([
      loadMarketingHost().catch(() => ({ marketingHost: false })),
      loadPublicMarketing().catch(() => emptyMarketingPage()),
    ]);
    return { marketingHost: host.marketingHost, supportEmail: marketing.supportEmail };
  },
  head: () => ({
    meta: [
      { title: "Delete your account | Ora Psychic" },
      {
        name: "description",
        content:
          "Request deletion of your Ora Psychic account. See what is deleted, what is kept, and for how long.",
      },
      { property: "og:title", content: "Delete your account | Ora Psychic" },
      { property: "og:url", content: "https://orapsychic.com/delete-account" },
    ],
    links: [{ rel: "canonical", href: "https://orapsychic.com/delete-account" }],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const data = Route.useLoaderData();
  const body = <DeleteAccountBody />;
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

function DeleteAccountBody() {
  const { user, isPending } = useCurrentUserState();
  return (
    <>
      <p className="text-xs tracking-[0.2em] text-primary uppercase">Ora Psychic</p>
      <h1 className="mt-2 font-display text-4xl text-fg md:text-5xl">Delete your account</h1>
      <p className="mt-3 text-sm text-muted">
        This page is public. You do not need to be signed in to read it. Deleting an account requires your own sign-in, so one person cannot delete someone else’s account.
      </p>
      <div className="mt-8">
        <DeleteAccountDisclosure />
      </div>
      <section className="mt-8 space-y-3 text-sm leading-relaxed text-muted md:text-base">
        <h2 className="font-display text-2xl text-fg md:text-3xl">How to request deletion</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <Link to="/login" className="text-primary">
              Sign in
            </Link>{" "}
            to the Ora account you want to close. The app is orapsychic.xyz. The website is orapsychic.com. Both use the same account.
          </li>
          <li>Open Account, then Account settings. You can also stay on this page after you are signed in.</li>
          <li>Choose Delete account, read the notice, then continue.</li>
          <li>Confirm again by checking the box and typing DELETE. Ora deletes the account only after that second confirmation.</li>
        </ol>
        <p>
          Approved advisor profiles are not removed here. An advisor should contact support so the public listing and payout records can be handled separately.
        </p>
      </section>
      <div className="mt-6">
        {isPending ? <p className="text-sm text-muted">Checking your sign-in…</p> : null}
        {!isPending && user ? <DeleteAccountPanel embedded /> : null}
        {!isPending && !user ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="rounded-full">
              <Link to="/login">Sign in to delete your account</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/privacy">Privacy policy</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
