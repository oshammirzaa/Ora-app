import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { DeskLinkRow } from "@/components/advisor-desk";

export const Route = createFileRoute("/advisor/settings")({ component: SettingsLayout });

function SettingsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/advisor/settings" && path !== "/advisor/settings/") return <Outlet />;
  return <SettingsPage />;
}

function SettingsPage() {
  return (
    <main className="space-y-4">
      <p className="text-sm text-muted">Account, blocked clients, reviews, and desk help. Public listing stays on Edit Profile.</p>
      <nav className="space-y-2">
        <DeskLinkRow to="/advisor/settings/security" label="Account & Security" hint="Password and sign out" />
        <DeskLinkRow to="/advisor/settings/blocked" label="Blocked Users" hint="Clients who cannot start a new chat" />
        <DeskLinkRow to="/advisor/settings/reviews" label="Rate & Review" hint="Ratings from completed live chats" />
        <DeskLinkRow to="/advisor/earnings" label="Revenue" hint="Split, withdrawals, and history" />
        <DeskLinkRow to="/support" label="Get Help" hint="Write to Ora support" />
        <DeskLinkRow to="/advisor/settings/faq" label="FAQ" hint="How the desk, split, and blocks work" />
        <DeskLinkRow to="/advisor/settings/replies" label="Quick Reply" hint="Saved phrases for Messages" />
      </nav>
    </main>
  );
}
