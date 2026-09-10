import { createFileRoute, Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia } from "@/components/advisor-media";
import { AdvisorShell } from "@/components/advisor-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient, signOut } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readImageFile } from "@/lib/file-data";
import { getDesk, saveAdvisorProfile, setOnline, type Desk } from "@/lib/ora";

export const Route = createFileRoute("/advisor/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [languages, setLanguages] = useState("English");
  const [years, setYears] = useState(0);
  const [rate, setRate] = useState(0);
  const [photo, setPhoto] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getDesk().then((d) => {
      setDesk(d);
      if (d.advisor) {
        setName(d.advisor.name);
        setBio(d.advisor.bio);
        setExperience(d.advisor.experience);
        setSpecialties(d.advisor.specialties);
        setLanguages(d.advisor.languages);
        setYears(d.advisor.years);
        setRate(d.advisor.rateCoins);
      }
    });
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await saveAdvisorProfile({
        data: {
          name,
          bio,
          experience,
          specialties,
          rateCoins: rate,
          languages,
          years,
          photoUrl: photo || undefined,
        },
      });
      toast.success("Profile saved.");
      setDesk(await getDesk());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  if (isPending) {
    return (
      <AdvisorShell tab="profile">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" />
      </AdvisorShell>
    );
  }
  if (!user) return <RedirectToSignIn to="/advisor/login" />;
  const adv = desk?.advisor;

  return (
    <AdvisorShell
      tab="profile"
      online={adv?.online}
      busy={adv?.busy}
      canToggle={adv?.status === "live"}
      onToggle={(v) => void setOnline({ data: { online: v } }).then(() => getDesk().then(setDesk))}
    >
      <main className="px-4 py-8">
        <h1 className="font-display text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          {adv
            ? `${adv.status === "live" ? "Approved" : adv.status} · ${adv.rating.toFixed(1)} from ${adv.reviews} reviews`
            : desk?.applicationStatus
              ? `Application ${desk.applicationStatus}`
              : "No live profile yet."}
        </p>
        {desk?.me.email ? <p className="mt-1 text-sm text-faint">{desk.me.email}</p> : null}

        <section className="mt-4 rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Verification</p>
          <p className="mt-1">
            {adv?.status === "live"
              ? "Approved. Toggle Online on the desk to appear Live."
              : desk?.applicationStatus === "pending"
                ? "Pending house review. You cannot go online yet."
                : desk?.applicationStatus === "declined"
                  ? "Declined. Update your application and submit again."
                  : "Submit an application to open a desk."}
          </p>
        </section>

        {adv ? (
          <form onSubmit={(e) => void save(e)} className="mt-6 space-y-3">
            <div className="aspect-3/4 overflow-hidden rounded-xl bg-elevated">
              <AdvisorMedia photo={photo || adv.photoUrl} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Replace photo</Label>
              <Input
                id="ph"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readImageFile(f).then(setPhoto).catch((err) => toast.error(String(err.message)));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n">Display name</Label>
              <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b">Bio</Label>
              <Textarea id="b" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e">Experience</Label>
              <Textarea id="e" value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s">Specialties</Label>
              <Input id="s" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="l">Languages</Label>
              <Input id="l" value={languages} onChange={(e) => setLanguages(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="y">Years</Label>
                <Input id="y" type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r">Coins / min</Label>
                <Input id="r" type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Save profile
            </Button>
          </form>
        ) : null}

        <section className="mt-8">
          <h2 className="font-display text-xl">Ratings and reviews</h2>
          {!desk?.reviews.length ? (
            <p className="mt-2 text-sm text-muted">No reviews yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {desk.reviews.map((r) => (
                <li key={r.id} className="rounded-xl bg-surface p-4 text-sm shadow-[var(--shadow-border)]">
                  <p className="inline-flex items-center gap-1 text-primary">
                    <Star className="size-3 fill-primary" /> {r.rating}
                  </p>
                  {r.body ? <p className="mt-1 text-muted">{r.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Account settings</h2>
          <p className="mt-1 text-sm text-muted">{desk?.me.email || user.primaryEmail || "Email on file"}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const client = authClient as typeof authClient & {
                changePassword?: (opts: {
                  currentPassword: string;
                  newPassword: string;
                }) => Promise<{ error?: { message?: string } }>;
              };
              if (!client.changePassword) {
                toast.error("Password change is not available for this sign-in method.");
                return;
              }
              void client
                .changePassword({ currentPassword: currentPw, newPassword: newPw })
                .then(({ error }) => {
                  if (error) {
                    toast.error(error.message || "Could not update password");
                    return;
                  }
                  setCurrentPw("");
                  setNewPw("");
                  toast.success("Password updated.");
                });
            }}
            className="mt-4 space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="cpw">Current password</Label>
              <Input id="cpw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} minLength={8} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="npw">New password</Label>
              <Input id="npw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" variant="outline">
              Update password
            </Button>
          </form>
          <Link to="/me" className="mt-4 block text-sm text-primary">
            Open customer account
          </Link>
        </section>

        <Button
          variant="outline"
          className="mt-8 w-full"
          disabled={out}
          onClick={() => {
            setOut(true);
            void signOut().catch(() => setOut(false));
          }}
        >
          {out ? "Signing out…" : "Log out"}
        </Button>
      </main>
    </AdvisorShell>
  );
}
