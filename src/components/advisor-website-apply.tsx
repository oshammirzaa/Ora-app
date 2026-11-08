import { ADVISOR_APPLY_URL } from "@/lib/ora-domains";

/** Shown inside the Android and iOS app. The application form stays on the website. */
export function AdvisorWebsiteApplyNote() {
  return (
    <p className="text-sm text-muted">
      New advisor applications, including Government ID verification, are accepted only on the Ora website at{" "}
      <a href={ADVISOR_APPLY_URL} className="text-primary" target="_blank" rel="noopener noreferrer">
        orapsychic.com/advisor/signup
      </a>
      .
    </p>
  );
}
