import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminViewAsStatus } from "@/lib/ora-admin-advisor-ops";

export const Route = createFileRoute("/advisor/settings/security")({ component: SecurityPage });

function SecurityPage() {
  const { user, isPending } = useCurrentUserState();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [out, setOut] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    void adminViewAsStatus()
      .then((state) => setViewing(state.active))
      .catch(() => setViewing(false));
  }, []);

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    const client = authClient as typeof authClient & {
      changePassword?: (opts: { currentPassword: string; newPassword: string }) => Promise<{ error?: { message?: string } }>;
    };
    if (!client.changePassword) {
      toast.error("Password change is not available for this sign-in method.");
      return;
    }
    const { error } = await client.changePassword({ currentPassword: currentPw, newPassword: newPw });
    if (error) {
      toast.error(error.message || "Could not update password");
      return;
    }
    setCurrentPw("");
    setNewPw("");
    toast.success("Password updated.");
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <main className="space-y-4">
      <Link to="/advisor/settings" preload={false} className="text-sm text-primary">
        Back to Settings
      </Link>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Change Password</h2>
        {viewing ? (
          <p className="mt-1 text-sm text-muted">
            Password, payout, and security changes are locked while viewing as an advisor. Exit to return to your admin account.
          </p>
        ) : (
          <>
        <p className="mt-1 text-sm text-muted">Use your current advisor password, then choose a new one of at least 8 characters.</p>
        <form onSubmit={(e) => void savePassword(e)} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cpw">Current password</Label>
            <Input id="cpw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="npw">New password</Label>
            <Input id="npw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
          </div>
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
          </>
        )}
      </section>
      <Button
        variant="outline"
        className="w-full"
        disabled={out}
        onClick={() => {
          setOut(true);
          void signOut().finally(() => setOut(false));
        }}
      >
        Sign out
      </Button>
    </main>
  );
}
