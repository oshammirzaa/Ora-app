import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthFrame, PasswordField, SocialSignIn } from "@/components/auth-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readImageFile } from "@/lib/file-data";
import { applyAdvisor } from "@/lib/ora";

export const Route = createFileRoute("/advisor/signup")({ component: AdvisorSignup });

function AdvisorSignup() {
  const { user } = useCurrentUserState();
  const [legalName, setLegalName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("Tarot, Love");
  const [languages, setLanguages] = useState("English");
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(20);
  const [photo, setPhoto] = useState("");
  const [terms, setTerms] = useState(false);
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

  async function submitApplication() {
    await applyAdvisor({
      data: {
        name: name.trim(),
        legalName: legalName.trim(),
        bio,
        experience,
        specialties,
        rateCoins: rate,
        photoUrl: photo,
        languages,
        years,
      },
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) {
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }
    if (!terms) {
      setError("Accept the terms to apply.");
      return;
    }
    if (!photo) {
      setError("Add a profile photo.");
      return;
    }
    setBusy(true);
    try {
      if (!user) {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: legalName.trim() || name.trim(),
          callbackURL: "/advisor",
        });
        if (err) throw new Error(err.message || "Could not create account");
      }
      await submitApplication();
      window.location.assign("/advisor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Advisor application" subtitle="Create your desk account. The house reviews you before you can go live.">
      {authEnabled ? (
        <>
          {user ? null : (
            <>
              <SocialSignIn callbackURL="/advisor/signup" />
              <p className="text-center text-xs tracking-wide text-faint uppercase">or email</p>
            </>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="legal">Full name</Label>
              <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disp">Advisor display name</Label>
              <Input id="disp" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            {user ? (
              <p className="text-sm text-muted">Applying with {user.primaryEmail || user.displayName}.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <PasswordField id="pw" label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
                <PasswordField id="pw2" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="photo">Profile photo</Label>
              <Input id="photo" type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
              {photo ? <img src={photo} alt="" className="mt-2 h-28 w-24 rounded-md object-cover" /> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio / about me</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex">Experience</Label>
              <Textarea id="ex" value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp">Specialties</Label>
              <Input id="sp" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="yr">Years</Label>
                <Input id="yr" type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">Coins / min</Label>
                <Input id="rate" type="number" min={8} max={80} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lang">Languages</Label>
              <Input id="lang" value={languages} onChange={(e) => setLanguages(e.target.value)} />
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 size-4 accent-primary" />
              <span>
                I accept the{" "}
                <Link to="/terms" className="text-primary">
                  terms
                </Link>
                . The house must approve me before I go online.
              </span>
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </form>
          <p className="text-sm text-muted">
            Already applied?{" "}
            <Link to="/advisor/login" className="text-primary">
              Advisor sign in
            </Link>
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Sign-up is disabled.</p>
      )}
    </AuthFrame>
  );
}
