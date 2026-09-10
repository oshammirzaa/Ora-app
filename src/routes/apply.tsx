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

export const Route = createFileRoute("/apply")({ component: ApplyPage });

function ApplyPage() {
  const { user, isPending } = useCurrentUserState();
  const [legalName, setLegalName] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("Tarot, Love");
  const [languages, setLanguages] = useState("English");
  const [years, setYears] = useState(5);
  const [rate, setRate] = useState(20);
  const [photo, setPhoto] = useState("");
  const [video, setVideo] = useState("");
  const [sent, setSent] = useState(false);

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
    try {
      await applyAdvisor({
        data: {
          name,
          legalName,
          bio,
          experience,
          specialties,
          rateCoins: rate,
          photoUrl: photo,
          videoUrl: video,
          languages,
          years,
        },
      });
      setSent(true);
      toast.success("Application sent. The panel reviews it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    }
  }

  return (
    <AppShell tab="work">
      <main className="px-4 py-8">
        <h1 className="font-display text-3xl">Advisor application</h1>
        <p className="mt-2 text-sm text-muted">
          Full name, working name, bio, specialties, years, rate, languages, and a photo. The house
          approves you before you can go Live.
        </p>
        {isPending ? <div className="mt-8 h-40 animate-pulse rounded-xl bg-elevated" /> : null}
        <SignInGate
          fallback={
            <div className="mt-8">
              <p className="text-sm text-muted">Sign in to apply with this account, or create an advisor desk.</p>
              <Button asChild className="mt-3 w-full">
                <Link to="/advisor/signup">Create advisor account</Link>
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/login">Customer sign in</Link>
              </Button>
            </div>
          }
        >
          {sent ? (
            <p className="mt-8 rounded-xl bg-surface p-6 text-ok">
              Received. Watch the advisor desk after you are approved — you cannot go online until then.
            </p>
          ) : user ? (
            <form onSubmit={submit} className="mt-8 space-y-4">
              <Field label="Full name" id="legal">
                <Input id="legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={2} />
              </Field>
              <Field label="Advisor display name" id="n">
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Bio / about me" id="b">
                <Textarea
                  id="b"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  required
                  minLength={20}
                  placeholder="What you read, how you sit with people. At least 20 characters."
                />
              </Field>
              <Field label="Experience" id="e">
                <Textarea
                  id="e"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Years, training, rooms you've worked."
                />
              </Field>
              <Field label="Specialties" id="s">
                <Input id="s" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Years" id="yr">
                  <Input id="yr" type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} />
                </Field>
                <Field label="Coins / min" id="r">
                  <Input
                    id="r"
                    type="number"
                    min={8}
                    max={80}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </Field>
              </div>
              <p className="text-xs text-faint">10 coins = $1. 20 coins/min is $2/min.</p>
              <Field label="Languages" id="lang">
                <Input id="lang" value={languages} onChange={(e) => setLanguages(e.target.value)} />
              </Field>
              <Field label="Photo" id="p">
                <Input
                  id="p"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPhoto(e.target.files?.[0])}
                />
                {photo ? <img src={photo} alt="" className="mt-2 h-32 rounded-md object-cover" /> : null}
              </Field>
              <Field label="Intro video URL" id="v">
                <Input
                  id="v"
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                  placeholder="YouTube, Vimeo, or a direct .mp4 link"
                />
              </Field>
              <Button type="submit">Submit application</Button>
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
