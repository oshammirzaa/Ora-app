import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminPremiumBoard, adminSavePremium } from "@/lib/ora-premium-api";
import { PREMIUM_FLAG_KEYS } from "@/lib/ora-feature-flags";

export const Route = createFileRoute("/admin/premium")({ component: PremiumAdmin });

function PremiumAdmin() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminPremiumBoard>> | null>(null);
  const [failed, setFailed] = useState("");
  const [cardId, setCardId] = useState("star");
  const [meaning, setMeaning] = useState("");
  const [moodId, setMoodId] = useState("confused");
  const [moodMessage, setMoodMessage] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setData(await adminPremiumBoard());
  }

  useEffect(() => {
    void load().catch((err) => setFailed(err instanceof Error ? err.message : "Could not load"));
  }, []);

  if (!data && !failed) return <div className="h-40 animate-pulse rounded-xl bg-elevated" />;
  if (!data) return <main><h1 className="font-display text-3xl">Membership tools</h1><p className="mt-2 text-sm text-muted">{failed}</p></main>;

  const vault = data.vault.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${row.advisorName} ${row.customer} ${row.body}`.toLowerCase().includes(q);
  });

  return (
    <main className="space-y-6">
      <h1 className="font-display text-3xl">Membership tools</h1>
      <p className="text-sm text-muted">Ora Membership only. Private timelines, moods, and compatibility reports are not listed here. Counts are aggregates.</p>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Switches</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PREMIUM_FLAG_KEYS.map((key) => (
            <li key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="capitalize">{key}{key === "extensions" ? " (paid, off until you enable it)" : ""}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void adminSavePremium({ data: { flags: { [key]: !data.flags[key] } } }).then(load).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"))}
              >
                {data.flags[key] ? "On" : "Off"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Waiting queue</h2>
        <p className="text-sm text-muted">Max {data.queue.maxLength} · invitation {data.queue.inviteSeconds}s · {data.queue.enabled ? "enabled" : "disabled"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void adminSavePremium({ data: { queue: { enabled: !data.queue.enabled } } }).then(load)}>Toggle queue</Button>
          <Button size="sm" variant="outline" onClick={() => void adminSavePremium({ data: { queue: { maxLength: data.queue.maxLength === 12 ? 8 : 12 } } }).then(load)}>Max 12 / 8</Button>
          <Button size="sm" variant="outline" onClick={() => void adminSavePremium({ data: { queue: { inviteSeconds: data.queue.inviteSeconds === 60 ? 45 : 60 } } }).then(load)}>Window 60s / 45s</Button>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {Object.entries(data.usage).map(([key, value]) => (
          <p key={key} className="rounded-2xl bg-surface px-3 py-3 text-sm shadow-[var(--shadow-border)]">
            <span className="block text-xs text-muted capitalize">{key}</span>
            <span className="font-display text-2xl">{value}</span>
          </p>
        ))}
      </section>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Copy</h2>
        <label className="mt-2 block text-xs text-muted">Tarot card</label>
        <select className="mt-1 h-10 rounded-xl bg-elevated px-3 text-sm" value={cardId} onChange={(event) => setCardId(event.target.value)}>
          {data.cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
        </select>
        <Textarea className="mt-2" aria-label="Tarot meaning" placeholder="Replacement meaning" value={meaning} onChange={(event) => setMeaning(event.target.value)} />
        <Button className="mt-2" size="sm" onClick={() => void adminSavePremium({ data: { tarot: { id: cardId, meaning } } }).then(() => toast.success("Card copy saved")).then(load)}>Save card meaning</Button>
        <label className="mt-4 block text-xs text-muted">Mood message</label>
        <select className="mt-1 h-10 rounded-xl bg-elevated px-3 text-sm" value={moodId} onChange={(event) => setMoodId(event.target.value)}>
          {data.moods.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
        </select>
        <Input className="mt-2" aria-label="Mood message" value={moodMessage} onChange={(event) => setMoodMessage(event.target.value)} placeholder="Supportive message" />
        <Button className="mt-2" size="sm" variant="outline" onClick={() => void adminSavePremium({ data: { mood: { id: moodId, message: moodMessage } } }).then(load)}>Save mood copy</Button>
      </section>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Reported highlights</h2>
        {!data.reported.length ? <p className="text-sm text-muted">None reported.</p> : null}
        <ul className="mt-2 space-y-2 text-sm">
          {data.reported.map((row) => (
            <li key={row.readingId} className="rounded-xl bg-elevated px-3 py-2">
              <p>{row.advisorName}</p>
              <p className="text-muted">{row.insights.join(" · ")}</p>
              <Button size="sm" variant="ghost" onClick={() => void adminSavePremium({ data: { hideHighlightId: row.readingId } }).then(load)}>Hide</Button>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Future message moderation</h2>
        <Input aria-label="Search vault" placeholder="Search advisor or client" value={search} onChange={(event) => setSearch(event.target.value)} />
        <ul className="mt-2 space-y-2 text-sm">
          {vault.map((row) => (
            <li key={row.id} className="rounded-xl bg-elevated px-3 py-2">
              <p>{row.advisorName} → {row.customer} · {row.status}</p>
              <p className="text-muted">{row.body}</p>
              <Button size="sm" variant="ghost" onClick={() => void adminSavePremium({ data: { hideVaultId: row.id } }).then(load)}>Hide</Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
