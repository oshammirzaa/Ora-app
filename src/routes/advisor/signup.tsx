import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { requiredApplicationError } from "@/lib/ora-advisor-auth";
import { idNeedsBack, identityFormError } from "@/lib/ora-identity";
import { uploadIdentityDocuments } from "@/lib/ora-identity-file";
import {
  emptyIdentityDraft,
  GovernmentIdentityFields,
  identityPayload,
  type IdentityDraft,
} from "@/components/government-identity-fields";

export const Route = createFileRoute("/advisor/signup")({ component: AdvisorSignup });

async function waitForSession() {
  for (let i = 0; i < 25; i += 1) {
    const { data } = await authClient.getSession();
    if (data?.user) return data.user;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Account created, but sign-in is not ready yet. Open Advisor sign in, then submit again.");
}

function AdvisorSignup() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [identity, setIdentity] = useState<IdentityDraft>(emptyIdentityDraft);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [availability, setAvailability] = useState("");
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

  async function submitApplication(accountEmail: string) {
    const saved = await applyAdvisor({
      data: {
        name: name.trim(),
        legalName: legalName.trim(),
        bio,
        experience,
        specialties,
        rateCoins: rate,
        photoUrl: photo,
        years,
        email: accountEmail,
        phone,
        country,
        availability,
        identity: identityPayload(identity, legalName.trim()),
      },
    });
    if (!saved?.id || saved.status !== "pending" || !saved.identityId) throw new Error("Application did not save. Try again.");
    await uploadIdentityDocuments(saved.identityId, {
      front: identity.front,
      back: idNeedsBack(identity.idType) ? identity.back : null,
      selfie: identity.selfie,
      holding: identity.holding,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const accountEmail = (email || user?.primaryEmail || "").trim();
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
    const missing = requiredApplicationError({
      legalName,
      name,
      email: accountEmail,
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
      return;
    }
    const idError = identityFormError({
      legalName,
      country: identity.country,
      idType: identity.idType,
      consent: identity.consent,
      front: identity.front,
      back: idNeedsBack(identity.idType) ? identity.back : null,
      selfie: identity.selfie,
      holding: identity.holding,
    });
    if (idError) {
      setError(idError);
      return;
    }
    setBusy(true);
    try {
      if (!user) {
        const { error: err } = await authClient.signUp.email({
          email: accountEmail,
          password,
          name: legalName.trim() || name.trim(),
        });
        if (err) {
          const { error: signInErr } = await authClient.signIn.email({
            email: accountEmail,
            password,
          });
          if (signInErr) throw new Error(err.message || "Could not create account");
        }
        await waitForSession();
      }
      await submitApplication(accountEmail);
      await navigate({ to: "/advisor/applied" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the application. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame lockup title="Apply as Advisor" subtitle="Create your account and send the application. It stays Pending Verification until an admin approves it.">
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
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} required />
            </div>
            <GovernmentIdentityFields
              draft={identity}
              onChange={setIdentity}
              onFileError={(message) => {
                setError(message);
                toast.error(message);
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="photo">Profile photo (optional)</Label>
              <Input id="photo" type="file" accept="image/*" onChange={(e) => void onPhoto(e.target.files?.[0])} />
              <p className="text-xs text-faint">A small image URL can be added later. Large photos are not stored in the database.</p>
              {photo ? <img src={photo} alt="" className="mt-2 h-28 w-24 rounded-md object-cover" /> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp">Specialties</Label>
              <Input id="sp" value={specialties} onChange={(e) => setSpecialties(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="yr">Years of experience</Label>
                <Input id="yr" type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate">Requested coins / min</Label>
                <Input id="rate" type="number" min={8} max={80} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex">Experience</Label>
              <Textarea id="ex" value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av">Availability</Label>
              <Textarea id="av" value={availability} onChange={(e) => setAvailability(e.target.value)} required placeholder="Days, hours, time zone" />
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 size-4 accent-primary" />
              <span>
                I accept the{" "}
                <Link to="/terms" className="text-primary">
                  terms
                </Link>
                . The owner must approve me before I go online.
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
