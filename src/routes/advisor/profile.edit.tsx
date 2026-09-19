import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Initials } from "@/components/advisor-desk";
import { AdvisorMedia } from "@/components/advisor-media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readImageFile } from "@/lib/file-data";
import { getAdvisorProfileEdit, saveAdvisorProfileEdit } from "@/lib/ora-advisor-desk";
import {
  ADVISOR_GENDERS,
  genderLabel,
  joinSpecialties,
  parseSpecialtiesList,
  type GalleryItem,
} from "@/lib/ora-advisor-desk-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advisor/profile/edit")({ component: EditProfilePage });

function EditProfilePage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("unspecified");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [languages, setLanguages] = useState("English");
  const [years, setYears] = useState(0);
  const [rate, setRate] = useState(20);
  const [photo, setPhoto] = useState("");
  const [video, setVideo] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [readingNotice, setReadingNotice] = useState("");
  const [quickGreeting, setQuickGreeting] = useState("");
  const [autoResponse, setAutoResponse] = useState("");
  const [autoLiveGreeting, setAutoLiveGreeting] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [extraSpec, setExtraSpec] = useState("");

  useEffect(() => {
    if (!user) return;
    void getAdvisorProfileEdit()
      .then((d) => {
        setName(d.name);
        setGender(d.gender);
        setHeadline(d.headline);
        setBio(d.bio);
        setExperience(d.experience);
        const cats = d.categories;
        const all = parseSpecialtiesList(d.specialties);
        setSpecialties(all.filter((s) => cats.some((c) => c.name.toLowerCase() === s.toLowerCase())));
        setExtraSpec(all.filter((s) => !cats.some((c) => c.name.toLowerCase() === s.toLowerCase())).join(", "));
        setLanguages(d.languages);
        setYears(d.years);
        setRate(d.rateCoins);
        setPhoto(d.photoUrl);
        setVideo(d.videoUrl);
        setGallery(d.gallery);
        setReadingNotice(d.readingNotice);
        setQuickGreeting(d.quickGreeting);
        setAutoResponse(d.autoResponse);
        setAutoLiveGreeting(d.autoLiveGreeting);
        setCategories(d.categories);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  async function onPhoto(file: File | undefined, target: "avatar" | "gallery") {
    if (!file) return;
    try {
      const data = await readImageFile(file);
      if (target === "avatar") {
        setPhoto(data);
        return;
      }
      if (gallery.filter((g) => g.kind === "photo").length >= 4) {
        toast.error("You can add up to four extra photos.");
        return;
      }
      setGallery((cur) => [...cur, { id: `gal_${Date.now().toString(36)}`, kind: "photo", src: data }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that photo");
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await saveAdvisorProfileEdit({
        data: {
          name,
          gender,
          headline,
          bio,
          experience,
          specialties: joinSpecialties([...specialties, ...parseSpecialtiesList(extraSpec)]),
          languages,
          years,
          rateCoins: rate,
          photoUrl: photo || undefined,
          videoUrl: video,
          gallery,
          readingNotice,
          quickGreeting,
          autoResponse,
          autoLiveGreeting,
        },
      });
      toast.success("Profile saved.");
      await navigate({ to: "/advisor/profile" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (isPending || loading) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!user) return <RedirectToSignIn to="/advisor/login" />;

  return (
    <main>
      <Link to="/advisor/profile" preload={false} className="text-sm text-primary">
        Back to My Profile
      </Link>
      <form onSubmit={(e) => void save(e)} className="mt-4 space-y-4 pb-4">
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Profile photo</p>
          <div className="mt-3 flex items-center gap-4">
            <label className="relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-full bg-elevated">
              {photo ? <AdvisorMedia photo={photo} /> : <Initials name={name || "A"} size="lg" />}
              <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-bg/70 text-primary">
                <Camera className="size-3.5" />
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                aria-label="Replace profile photo"
                onChange={(e) => {
                  void onPhoto(e.target.files?.[0], "avatar");
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted">Shown on the floor and at the top of My Profile. Use a clear face photo.</p>
          </div>
        </section>

        <Field id="disp" label="Display name">
          <Input id="disp" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        </Field>

        <Field id="gender" label="Gender">
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            aria-label="Gender"
            className="flex h-11 w-full rounded-md bg-elevated px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none"
          >
            {ADVISOR_GENDERS.map((g) => (
              <option key={g} value={g}>
                {genderLabel(g)}
              </option>
            ))}
          </select>
        </Field>

        <Field id="headline" label="Bio / headline">
          <Input
            id="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={160}
            placeholder="A short line clients see first"
          />
        </Field>

        <Field id="about" label="About Me">
          <Textarea id="about" value={bio} onChange={(e) => setBio(e.target.value)} rows={5} maxLength={1200} />
        </Field>

        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Photos / videos</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {gallery.map((item) => (
              <div key={item.id} className="relative aspect-square overflow-hidden rounded-lg bg-elevated">
                {item.kind === "photo" ? (
                  <AdvisorMedia photo={item.src} />
                ) : (
                  <p className="flex size-full items-center p-2 text-center text-xs text-muted">Video link</p>
                )}
                <button
                  type="button"
                  className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-bg/80 text-danger"
                  aria-label="Remove media"
                  onClick={() => setGallery((cur) => cur.filter((g) => g.id !== item.id))}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg bg-elevated text-xs text-muted">
              <Camera className="size-4 text-primary" />
              Add photo
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void onPhoto(e.target.files?.[0], "gallery");
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="video">Intro video URL</Label>
            <Input
              id="video"
              value={video}
              onChange={(e) => setVideo(e.target.value)}
              placeholder="YouTube or mp4 link"
            />
          </div>
        </section>

        <Field id="exp" label="Work experience">
          <Textarea id="exp" value={experience} onChange={(e) => setExperience(e.target.value)} rows={4} maxLength={800} />
        </Field>

        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs tracking-wide text-faint uppercase">Service categories / specialties</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => {
              const on = specialties.some((s) => s.toLowerCase() === cat.name.toLowerCase());
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSpecialties((cur) =>
                      on ? cur.filter((s) => s.toLowerCase() !== cat.name.toLowerCase()) : [...cur, cat.name],
                    );
                  }}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full px-4 text-sm",
                    on ? "bg-primary text-primary-fg" : "bg-elevated text-muted",
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="extra-sp">Other specialties</Label>
            <Input
              id="extra-sp"
              value={extraSpec}
              onChange={(e) => setExtraSpec(e.target.value)}
              placeholder="Tarot, Timing"
            />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Field id="lang" label="Languages">
            <Input id="lang" value={languages} onChange={(e) => setLanguages(e.target.value)} />
          </Field>
          <Field id="years" label="Years">
            <Input id="years" type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} />
          </Field>
        </div>
        <Field id="rate" label="Coins / min">
          <Input id="rate" type="number" min={8} max={80} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </Field>

        <Field id="notice" label="Reading Notice">
          <Textarea
            id="notice"
            value={readingNotice}
            onChange={(e) => setReadingNotice(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="Shown as a note on your listing — hours, topics you skip, or how you work."
          />
        </Field>
        <Field id="greet" label="Quick Greeting">
          <Textarea
            id="greet"
            value={quickGreeting}
            onChange={(e) => setQuickGreeting(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="A short hello you can reuse in Messages."
          />
        </Field>
        <Field id="auto" label="Automatic Response">
          <Textarea
            id="auto"
            value={autoResponse}
            onChange={(e) => setAutoResponse(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="Saved reply for when you cannot answer immediately."
          />
        </Field>
        <Field id="live-greet" label="Automatic Live Chat Greeting">
          <Textarea
            id="live-greet"
            value={autoLiveGreeting}
            onChange={(e) => setAutoLiveGreeting(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder="First message when a paid live text chat starts."
          />
        </Field>

        <div className="sticky bottom-20 z-20 bg-bg/95 pt-2 pb-1 backdrop-blur-md">
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
