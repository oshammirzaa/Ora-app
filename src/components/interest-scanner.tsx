import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORMS, type Platform } from "@/lib/catalog";
import { SAMPLES, scoreInterest, type InterestBand, type InterestResult } from "@/lib/interest";
import { useEmber } from "@/lib/store";
import { cn } from "@/lib/utils";

function bandLabel(b: InterestBand) {
  if (b === "hot") return "Interested";
  if (b === "warm") return "Maybe";
  if (b === "skip") return "Skip";
  return "Not now";
}

function bandClass(b: InterestBand) {
  if (b === "hot") return "text-ok";
  if (b === "warm") return "text-warn";
  if (b === "skip") return "text-danger";
  return "text-muted";
}

export function InterestScanner() {
  const addLead = useEmber((s) => s.addLead);
  const [text, setText] = useState("");
  const [result, setResult] = useState<InterestResult | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [platform, setPlatform] = useState<Platform>("tiktok");

  function analyze(value = text) {
    const t = value.trim();
    if (t.length < 8) {
      toast.error("Paste a post, comment, or message first.");
      return;
    }
    setText(value);
    setResult(scoreInterest(t));
  }

  function save() {
    if (!result) return;
    if (!name.trim() || !contact.trim()) {
      toast.error("Add a name and a handle or number before saving.");
      return;
    }
    addLead({
      name: name.trim(),
      contact: contact.trim(),
      platform,
      planId: result.planId,
      status: result.band === "hot" ? "interested" : "new",
      notes: `${result.band.toUpperCase()} ${result.score}/100. ${result.summary} Post: “${text.trim().slice(0, 180)}”`,
    });
    toast.success("Saved to Leads.");
    setName("");
    setContact("");
  }

  async function copyReply() {
    if (!result) return;
    await navigator.clipboard.writeText(result.reply);
    toast.success("Reply copied.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => analyze(s.text)}
            className="min-h-11 rounded-full bg-elevated px-3 text-sm text-muted hover:text-fg"
          >
            Try: {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="post">Paste a post, comment, or message</Label>
        <Textarea
          id="post"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-32"
          placeholder="e.g. Anyone know a good firestick for live cricket…"
        />
        <Button onClick={() => analyze()}>Check interest</Button>
      </div>

      {result ? (
        <div className="space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs tracking-wide text-faint uppercase">Interest</p>
              <p className={cn("font-display text-4xl", bandClass(result.band))}>{bandLabel(result.band)}</p>
            </div>
            <p className="font-display text-3xl tabular-nums text-fg">{result.score}</p>
          </div>
          <p className="text-sm text-muted">{result.summary}</p>
          {result.hits.length ? (
            <ul className="flex flex-wrap gap-2">
              {result.hits.map((h) => (
                <li key={h.label} className="rounded-full bg-elevated px-3 py-1 text-xs text-muted">
                  {h.label}
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <p className="text-xs tracking-wide text-faint uppercase">Suggested reply</p>
            <p className="mt-2 text-sm text-fg">{result.reply}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void copyReply()}>
              Copy reply
            </Button>
          </div>
          {result.band !== "skip" && result.band !== "cold" ? (
            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="iname">Name or @handle</Label>
                <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icontact">Number or profile link</Label>
                <Input id="icontact" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Where you saw them</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={save}>
                  Save as lead
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
