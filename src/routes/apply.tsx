import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn, SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readImageFile } from "@/lib/file-data";
import { applyAdvisor } from "@/lib/ora";
import { requiredApplicationError } from "@/lib/ora-advisor-auth";

export const Route = createFileRoute("/apply")({ component: ApplyPage });

function ApplyPage() {
  const { user, isPending } = useCurrentUserState();
  const [legalName, setLegalName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [availability, setAvailability] = useState("");
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(20);
  const [photo, setPhoto] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      setPhoto(await readImageFile(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Photo failed");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const missing = requiredApplicationError({
      legalName,
      name,
      email: email || user?.primaryEmail || "",
      phone,
      country,
      bio,
      specialties,
      years,
      rateCoins: rate,
      availability,
      photoUrl: photo,
    });
    if (missing) {
      setError(missing);
      toast.error(missing);
      return;
    }
    setBusy(true);
    try {
      const saved = await applyAdvisor({
        data: {
          name,
          legalName,
          bio,
          experience,
          specialties,
          rateCoins: rate,
          photoUrl: photo,
          years,
          email: email || user?.primaryEmail || "",
          phone,
          country,
          availability,
        },
      });
      if (!saved?.id || saved.status !== "pending") throw new Error("Application did not save. Try again.");
      setSent(true);
      toast.success("Application sent as pending.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell tab="you">
      <main className="px-4 py-8">
        <h1 className="font-display text-3xl text-fg">Apply as Advisor</h1>
        <p className="mt-2 text-sm text-muted">
          Submit for owner review. Applications stay pending until approved — this does not make you live.
        </p>
        {isPending ? <div className="mt-8 h-40 animate-pulse rounded-xl bg-elevated" /> : null}
        <SignInGate
          fallback={
            <div className="mt-8">
              <p className="text-sm text-muted">Create an advisor account, or sign in with a customer account first.</p>
              <Button asChild className="mt-3 w-full rounded-full">
                <Link to="/advisor/signup">Apply as Advisor</Link>
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full rounded-full">
                <Link to="/login">Customer sign in</Link>
              </Button>
            </div>
          }
        >
          {sent ? (
            <div className="mt-8 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
              <p className="text-ok">Received and pending review. You cannot go online until the owner approves you.</p>
              <Button asChild className="mt-4 w-full">
                <Link to="/advisor/applied">View application status</Link>
              </Button>
            </div>
          ) : user ? (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Full name" id="legal">
                <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={2} />
              </Field>
              <Field label="Advisor display name" id="n">
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Email" id="em">
                <Input
                  id="em"
                  type="email"
                  value={email || user.primaryEmail || ""}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Phone" id="ph">
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </Field>
              <Field label="Country" id="co">
                <Input id="co" value={country} onChange={(e) => setCountry(e.target.value)} required />
              </Field>
              <Field label="Profile photo (optional)" id="p">
                <Input id="p" type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
                <p className="text-xs text-faint">Large photos are not stored in the database.</p>
                {photo ? <img src={photo} alt="" className="mt-2 h-32 rounded-md object-cover" /> : null}
              </Field>
              <Field label="Short bio" id="b">
                <Textarea
                  id="b"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  required
                  minLength={20}
                  placeholder="What you read, how you sit with people. At least 20 characters."
                />
              </Field>
              <Field label="Specialties" id="s">
                <Input id="s" value={specialties} onChange={(e) => setSpecialties(e.target.value)} required />
              </Field>
              <Field label="Years of experience" id="yr">
                <Input id="yr" type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} required />
              </Field>
              <Field label="Requested coins / min" id="r">
                <Input id="r" type="number" min={8} max={80} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
              </Field>
              <p className="text-xs text-faint">10 coins = $1. 20 coins/min is $2/min.</p>
              <Field label="Experience" id="e">
                <Textarea id="e" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Training, rooms, years on the floor." />
              </Field>
              <Field label="Availability" id="av">
                <Textarea id="av" value={availability} onChange={(e) => setAvailability(e.target.value)} required placeholder="Days and hours you can read, including time zone." />
              </Field>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Submitting…" : "Submit application"}
              </Button>
            </form>
          ) : (
            <RedirectToSignIn />
          )}
        </SignInGate>
        <p className="mt-8 text-sm text-muted">
          Already have a desk?{" "}
          <Link to="/advisor/login" className="text-primary">
            Advisor sign in
          </Link>
        </p>
      </main>
    </AppShell>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
