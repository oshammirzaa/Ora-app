import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdvisorMedia, AdvisorVideoEmbed } from "@/components/advisor-media";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { readImageFile } from "@/lib/file-data";
import { getStudio, saveStudio, type Advisor } from "@/lib/ora";
import { isDirectVideo } from "@/lib/video";

export const Route = createFileRoute("/studio")({ component: StudioPage });

function StudioPage() {
  const { user, isPending } = useCurrentUserState();
  const [adv, setAdv] = useState<Advisor | null | "load">("load");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [rate, setRate] = useState(0);
  const [photo, setPhoto] = useState("");
  const [video, setVideo] = useState("");

  useEffect(() => {
    if (!user) return;
    void getStudio().then((a) => {
      setAdv(a);
      if (a) {
        setBio(a.bio);
        setExperience(a.experience);
        setSpecialties(a.specialties);
        setRate(a.rateCoins);
        setVideo(a.videoUrl);
      }
    });
  }, [user]);

  if (isPending) {
    return (
      <AppShell tab="work">
        <div className="mx-4 mt-8 h-40 animate-pulse rounded-xl bg-elevated" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;

  async function save(e: FormEvent) {
    e.preventDefault();
    await saveStudio({
      data: {
        bio,
        experience,
        specialties,
        rateCoins: rate,
        photoUrl: photo || undefined,
        videoUrl: video,
      },
    });
    toast.success("Studio saved.");
    const a = await getStudio();
    setAdv(a);
    if (a) setPhoto("");
  }

  return (
    <AppShell tab="work">
      <main className="px-4 py-8">
        <h1 className="font-display text-3xl text-fg">Studio</h1>
        {adv === "load" ? (
          <div className="mt-8 h-32 animate-pulse rounded-xl bg-elevated" />
        ) : !adv ? (
          <p className="mt-6 text-muted">
            No live profile yet.{" "}
            <Link to="/apply" className="text-primary">
              Apply as an advisor
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={save} className="mt-8 space-y-4">
            <p className="text-sm text-muted">
              {adv.name} · {adv.status}
            </p>
            <div className="aspect-3/4 overflow-hidden rounded-xl bg-elevated">
              <AdvisorMedia photo={photo || adv.photoUrl} video={adv.videoUrl} alt="" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex">Experience</Label>
              <Textarea id="ex" value={experience} onChange={(e) => setExperience(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp">Specialties</Label>
              <Input id="sp" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt">Coins per minute</Label>
              <Input
                id="rt"
                type="number"
                min={8}
                max={80}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Replace photo</Label>
              <Input
                id="ph"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void readImageFile(f)
                      .then(setPhoto)
                      .catch((err) => toast.error(String(err.message)));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vid">Intro video URL</Label>
              <Input id="vid" value={video} onChange={(e) => setVideo(e.target.value)} />
            </div>
            {video && !isDirectVideo(video) ? <AdvisorVideoEmbed url={video} /> : null}
            <Button type="submit">Save profile</Button>
          </form>
        )}
      </main>
    </AppShell>
  );
}
