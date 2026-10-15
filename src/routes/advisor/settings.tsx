import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdvisorDeleteAccount } from "@/components/advisor-delete-account";
import { DeskLinkRow } from "@/components/advisor-desk";
import { useAdvancedFlags } from "@/components/advanced-links";

export const Route = createFileRoute("/advisor/settings")({ component: SettingsLayout });

function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/advisor/settings" && path !== "/advisor/settings/") return <Outlet />;
  return <SettingsPage />;
}

function SettingsPage() {
  const flags = useAdvancedFlags();
  return (
    <main className="space-y-4">
      <p className="text-sm text-muted">Account, blocked clients, reviews, and desk help. Public listing stays on Edit Profile.</p>
      <nav className="space-y-2">
        <DeskLinkRow to="/advisor/schedule" label="Schedule Availability" hint="Hours customers can find you online" />
        {flags?.schedule ? <DeskLinkRow to="/advisor/bookings" label="Scheduled Readings" hint="Accept future appointments. They do not charge coins." /> : null}
        {flags?.performance ? <DeskLinkRow to="/advisor/performance" label="Performance" hint="Private score from real readings. Commission stays the same." /> : null}
        {flags?.security ? <DeskLinkRow to="/security" label="Login Security" hint="Devices, sessions, and an optional authenticator" /> : null}
        <DeskLinkRow to="/advisor/todo" label="Follow-ups" hint="Private reminders for clients you have read with" />
        <DeskLinkRow to="/advisor/settings/security" label="Account & Security" hint="Password and sign out" />
        <DeskLinkRow to="/advisor/settings/blocked" label="Blocked Users" hint="Clients who cannot start a new chat" />
        <DeskLinkRow to="/advisor/settings/reviews" label="Rate & Review" hint="Ratings from completed live chats" />
        <DeskLinkRow to="/advisor/earnings" label="Revenue" hint="Split, withdrawals, and history" />
        <DeskLinkRow to="/support" label="Get Help" hint="Write to Ora support" />
        <DeskLinkRow to="/advisor/settings/faq" label="FAQ" hint="How the desk, split, and blocks work" />
        <DeskLinkRow to="/advisor/settings/replies" label="Quick Reply" hint="Saved phrases you can insert in private chat" />
      </nav>
      <AdvisorDeleteAccount />
    </main>
  );
}
