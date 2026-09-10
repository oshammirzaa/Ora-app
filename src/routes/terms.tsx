import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthFrame } from "@/components/auth-frame";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <AuthFrame title="Terms of use" subtitle="Ora is a live reading marketplace. Entertainment only.">
      <div className="space-y-3 text-sm text-muted">
        <p>You must be 18 or older. Readings are not medical, legal, or financial advice.</p>
        <p>First login gifts three minutes. A $10 subscription adds three minutes each week. After included time, advisors charge coins at their rate. Ten coins equal one dollar.</p>
        <p>You own your account. Do not share passwords. The owner panel may pause advisors and gift coins.</p>
        <p>
          <Link to="/signup" className="text-primary">
            Create account
          </Link>
          {" · "}
          <Link to="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
