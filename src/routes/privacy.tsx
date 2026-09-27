import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Ora Psychic" },
      {
        name: "description",
        content: "How the public Ora site handles advisor profiles, reviews, and account privacy.",
      },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <AuthFrame lockup title="Privacy Policy" subtitle="What the public Ora site shows, and what stays in your account.">
      <div className="space-y-3 text-sm text-muted">
        <p>
          The public pages show live advisor names, photos, specialties, published rates, ratings, review counts, and online status. They also show reviews that are already eligible to appear on Ora. Reviewer names are shortened.
        </p>
        <p>
          Readings, messages, coins, membership, and support tickets stay with the signed-in account. The public site does not list customer email addresses, private messages, or advisor payout details.
        </p>
        <p>
          Membership purchases use Ora's existing checkout. Ora does not ask you to pay an advisor outside your account.
        </p>
        <p>You must be 18 or older. Readings are for reflection and entertainment. They are not medical, legal, or financial advice, and they are not a promise of a particular result.</p>
        <p>
          <Link to="/support" className="text-primary">
            Contact support
          </Link>
          {" · "}
          <Link to="/terms" className="text-primary">
            Terms
          </Link>
          {" · "}
          <Link to="/" className="text-primary">
            Ora home
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
