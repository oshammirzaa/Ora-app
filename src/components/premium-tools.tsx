import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PremiumLock, PremiumNote, ToolFrame } from "@/components/premium-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptQueueOffer,
  affirmationState,
  badgeState,
  chooseCard,
  deleteCompatibility,
  deleteMood,
  deleteTimelineEvent,
  deleteVaultMessage,
  joinQueue,
  leaveQueue,
  listCompatibility,
  listTimeline,
  listVault,
  moodState,
  moonState,
  pickState,
  queueState,
  revealTarot,
  saveCompatibility,
  saveMood,
  saveTimelineEvent,
  setAffirmationInterests,
  setPremiumNotices,
  tarotState,
  toggleAffirmationFavorite,
} from "@/lib/ora-premium-api";
import { AFFIRM_CATEGORIES, MOODS, PREMIUM_NOTE, TIMELINE_KINDS, type MoonPhaseId } from "@/lib/ora-premium-rules";
import { cn } from "@/lib/utils";

function zone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function LockedOrOff({ state, plan }: { state: string; plan?: string }) {
  if (state === "locked") return <PremiumLock plan={plan || ""} />;
  if (state === "off") return <p className="text-sm text-muted">This tool is switched off right now.</p>;
  return null;
}

function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="grid place-items-center">
      <svg viewBox="0 0 140 140" className="size-40">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-[#eadfca]" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#c4a35a"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform="rotate(-90 70 70)"
          className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-700"
        />
        <text x="70" y="66" textAnchor="middle" className="fill-[#3d2a44] font-display text-[28px]">
          {pct}
        </text>
        <text x="70" y="86" textAnchor="middle" className="fill-[#8d6b32] text-[9px] tracking-[0.14em]">
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

function CardBack() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[#e6d3a1] bg-gradient-to-b from-[#4a2c55] to-[#241424] text-[#f3e2b0] [backface-visibility:hidden]">
      <div className="size-16 rounded-full border border-[#e6d3a1]/70" />
      <p className="mt-3 text-[10px] tracking-[0.22em] uppercase">Ora</p>
    </div>
  );
}

function CardFront({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl border border-[#e6d3a1] bg-[#fbf6ea] p-4 text-[#3d2a44] [backface-visibility:hidden] [transform:rotateY(180deg)]">
      <p className="text-[10px] tracking-[0.16em] text-[#8d6b32] uppercase">{title}</p>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function FlipCard({ flipped, title, detail }: { flipped: boolean; title: string; detail?: string }) {
  return (
    <div className="h-64 w-44 [perspective:1000px]">
      <div className={cn("relative h-full w-full motion-safe:transition-transform motion-safe:duration-700 [transform-style:preserve-3d]", flipped && "[transform:rotateY(180deg)]")}>
        <CardBack />
        <CardFront title={title}>{detail}</CardFront>
      </div>
    </div>
  );
}

export function LoveTool() {
  const [selfName, setSelfName] = useState("");
  const [selfBirth, setSelfBirth] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerBirth, setPartnerBirth] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof listCompatibility>> | null>(null);
  const [active, setActive] = useState<string>("");

  async function load() {
    setData(await listCompatibility());
  }
  useEffect(() => {
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <LockedOrOff state={data.state} plan={data.plan} />;
  const current = data.reports.find((row) => row.id === active) || data.reports[0];
  const report = current?.report;

  return (
    <ToolFrame kicker="Love" title="Compatibility" lede="Two birth dates, one illustrative score. It is not a measurement of your relationship.">
      <form
        className="grid gap-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCompatibility({ data: { selfName, selfBirth, partnerName, partnerBirth, status } })
            .then(async (res) => {
              if (res.state !== "ready") {
                setData({ state: res.state, plan: res.plan, reports: [] });
                return;
              }
              await load();
              if (res.report) setActive(res.report.id);
              toast.success("Saved on your account only.");
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
        }}
      >
        <Input aria-label="Your name" placeholder="Your name" value={selfName} onChange={(event) => setSelfName(event.target.value)} />
        <Input aria-label="Your birth date" type="date" value={selfBirth} onChange={(event) => setSelfBirth(event.target.value)} />
        <Input aria-label="Their name" placeholder="Their name" value={partnerName} onChange={(event) => setPartnerName(event.target.value)} />
        <Input aria-label="Their birth date" type="date" value={partnerBirth} onChange={(event) => setPartnerBirth(event.target.value)} />
        <Input className="sm:col-span-2" aria-label="Relationship status" placeholder="Optional status, such as dating or apart" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Button className="sm:col-span-2 rounded-full" type="submit">Save this connection</Button>
      </form>
      {report && current ? (
        <article className="mt-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <Meter value={current.overall} label="overall" />
            <div>
              <h2 className="font-display text-2xl">{current.selfName} and {current.partnerName}</h2>
              <p className="mt-1 text-sm text-muted">{current.selfSignLabel} · {current.partnerSignLabel}</p>
              <ul className="mt-3 grid gap-1 text-sm">
                <li>Emotional {report.emotional}</li>
                <li>Communication {report.communication}</li>
                <li>Romantic {report.romantic}</li>
                <li>Long-term themes {report.longTerm}</li>
              </ul>
            </div>
          </div>
          <h3 className="mt-4 text-sm font-medium">Strengths</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3 className="mt-3 text-sm font-medium">Challenges</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">{report.challenges.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="mt-3 text-sm">{report.suggestion}</p>
          <p className="mt-2 text-sm text-muted">{report.selfNote} {report.partnerNote}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-full"><Link to="/home">Discuss with a psychic</Link></Button>
            <Button variant="ghost" onClick={() => void deleteCompatibility({ data: { id: current.id } }).then(load)}>Delete</Button>
          </div>
        </article>
      ) : <p className="mt-4 text-sm text-muted">No saved connections yet.</p>}
      {data.reports.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {data.reports.map((row) => (
            <button key={row.id} type="button" className="shrink-0 rounded-full bg-elevated px-3 py-1 text-xs" onClick={() => setActive(row.id)}>
              {row.selfName} & {row.partnerName} · {row.overall}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-4"><PremiumNote /></p>
    </ToolFrame>
  );
}

export function TarotTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof tarotState>> | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setData(await tarotState({ data: { timeZone: zone() } }));
  }
  useEffect(() => {
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not open tarot"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Tarot" title="Daily card"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  const card = data.card;
  return (
    <ToolFrame kicker="Tarot" title="Today's card" lede="One reveal a day, in your timezone. It does not spend coins.">
      <div className="flex flex-col items-center">
        <button
          type="button"
          className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4a35a]"
          disabled={data.revealed || busy}
          onClick={() => {
            setBusy(true);
            void revealTarot({ data: { timeZone: zone() } })
              .then(() => load())
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not reveal"))
              .finally(() => setBusy(false));
          }}
          aria-label={data.revealed ? "Today's card" : "Reveal today's card"}
        >
          <FlipCard flipped={data.revealed} title={card?.name || "Your card"} detail={card?.meaning} />
        </button>
        {card ? (
          <article className="mt-5 w-full max-w-xl space-y-3 text-sm">
            <p><span className="text-[#8d6b32]">Love.</span> {card.love}</p>
            <p><span className="text-[#8d6b32]">Work.</span> {card.career}</p>
            <p><span className="text-[#8d6b32]">Reflection.</span> {card.reflection}</p>
            <p><span className="text-[#8d6b32]">Guidance.</span> {card.guidance}</p>
          </article>
        ) : <p className="mt-4 text-sm text-muted">Tap the card once. Refreshing will not draw another.</p>}
      </div>
      <NoticeToggles />
      {data.history.length ? (
        <ul className="mt-6 space-y-2">
          {data.history.map((row) => (
            <li key={row.date} className="rounded-2xl bg-surface px-3 py-2 text-sm">
              <span className="text-muted">{row.date}</span> · {row.card?.name}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4"><PremiumNote /></p>
    </ToolFrame>
  );
}

function NoticeToggles() {
  const [tarot, setTarot] = useState(false);
  const [moon, setMoon] = useState(false);
  const [affirm, setAffirm] = useState(false);
  return (
    <fieldset className="mt-6 space-y-2 rounded-2xl bg-surface p-4 text-sm">
      <legend className="text-xs tracking-wide text-muted uppercase">Optional reminders</legend>
      {[
        ["Daily tarot", tarot, setTarot],
        ["Full moon", moon, setMoon],
        ["Affirmation", affirm, setAffirm],
      ].map(([label, on, set]) => (
        <label key={String(label)} className="flex items-center justify-between gap-3">
          <span>{label as string}</span>
          <input
            type="checkbox"
            checked={Boolean(on)}
            onChange={(event) => {
              const next = event.target.checked;
              (set as (v: boolean) => void)(next);
              const payload = {
                tarot: label === "Daily tarot" ? next : tarot,
                moon: label === "Full moon" ? next : moon,
                affirm: label === "Affirmation" ? next : affirm,
              };
              void setPremiumNotices({ data: payload }).catch(() => toast.error("Could not save reminders"));
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}

export function PickTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof pickState>> | null>(null);
  useEffect(() => {
    void pickState({ data: { timeZone: zone() } }).then(setData).catch((err) => toast.error(err instanceof Error ? err.message : "Could not open"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Oracle" title="Pick a card"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  const picked = data.picked;
  return (
    <ToolFrame kicker="Oracle" title="Three cards" lede="Choose one. The page will not change your result if you refresh.">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[0, 1, 2].map((index) => {
          const open = data.pickedIndex === index && picked;
          return (
            <button
              key={index}
              type="button"
              className="shrink-0"
              disabled={data.pickedIndex >= 0}
              onClick={() => {
                void chooseCard({ data: { index, timeZone: zone() } })
                  .then(() => pickState({ data: { timeZone: zone() } }).then(setData))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not choose"));
              }}
              aria-label={open ? picked.name : `Card ${index + 1}`}
            >
              <FlipCard flipped={Boolean(open)} title={open ? picked.name : "Ora"} detail={open ? picked.theme : ""} />
            </button>
          );
        })}
      </div>
      {picked ? (
        <article className="mt-4 space-y-2 text-sm">
          <p>{picked.reflection}</p>
          <p><span className="text-[#8d6b32]">Love.</span> {picked.love}</p>
          <p><span className="text-[#8d6b32]">Work.</span> {picked.career}</p>
          <p className="font-display text-xl">{picked.affirmation}</p>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              const text = `${picked.name}: ${picked.reflection} ${picked.affirmation}`;
              void navigator.clipboard.writeText(text).then(() => toast.success("Copied. No account details included."));
            }}
          >
            Copy a shareable line
          </Button>
        </article>
      ) : null}
      <p className="mt-4"><PremiumNote /></p>
    </ToolFrame>
  );
}

const PHASE_LABEL: Record<MoonPhaseId, string> = {
  new: "New moon",
  "waxing-crescent": "Waxing crescent",
  "first-quarter": "First quarter",
  "waxing-gibbous": "Waxing gibbous",
  full: "Full moon",
  "waning-gibbous": "Waning gibbous",
  "last-quarter": "Last quarter",
  "waning-crescent": "Waning crescent",
};

export function MoonTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof moonState>> | null>(null);
  useEffect(() => {
    void moonState({ data: { timeZone: zone() } }).then(setData).catch((err) => toast.error(err instanceof Error ? err.message : "Could not load the moon"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready" || !data.copy) return <ToolFrame kicker="Moon" title="Calendar"><LockedOrOff state={data.state || "off"} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Moon" title={PHASE_LABEL[data.phase as MoonPhaseId] || "Moon"} lede={data.astronomy}>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center">
        <MoonGlyph phase={data.phase as MoonPhaseId} />
        <div>
          <p className="text-sm text-muted">About {data.illumination}% illuminated · age {data.ageDays} days</p>
          <h2 className="mt-2 font-display text-2xl">{data.copy.theme}</h2>
          <p className="mt-2 text-sm">{data.copy.prompt}</p>
          <p className="mt-2 text-sm text-muted">{data.copy.journal}</p>
          <p className="mt-3 font-display text-xl text-[#8d6b32]">{data.copy.affirmation}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-2">
        {(data.events || []).map((event) => (
          <li key={event.at} className="flex justify-between gap-3 rounded-2xl bg-surface px-3 py-2 text-sm">
            <span>{PHASE_LABEL[event.phase]}</span>
            <span className="text-muted">{new Date(event.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          </li>
        ))}
      </ul>
      <NoticeToggles />
    </ToolFrame>
  );
}

function MoonGlyph({ phase }: { phase: MoonPhaseId }) {
  const waxing = phase.startsWith("wax") || phase === "first-quarter" || phase === "full";
  const full = phase === "full";
  const dark = phase === "new";
  return (
    <svg viewBox="0 0 80 80" className="size-28" aria-hidden>
      <circle cx="40" cy="40" r="28" fill={dark ? "#2a1c31" : "#f4e7c4"} stroke="#c4a35a" />
      {!full ? <path d={waxing ? "M40 12a28 28 0 0 0 0 56 18 18 0 0 1 0-56z" : "M40 12a28 28 0 0 1 0 56 18 18 0 0 0 0-56z"} fill="#2a1c31" /> : null}
    </svg>
  );
}

export function AffirmTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof affirmationState>> | null>(null);
  const [category, setCategory] = useState("");
  async function load(next = category) {
    setData(await affirmationState({ data: { timeZone: zone(), category: next } }));
  }
  useEffect(() => {
    void load("").catch((err) => toast.error(err instanceof Error ? err.message : "Could not load"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Affirmation" title="Today"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Affirmation" title="A line for today" lede="Supportive and realistic. It does not promise love, money, or health.">
      <div className="flex flex-wrap gap-2">
        {AFFIRM_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={cn("rounded-full px-3 py-1 text-xs capitalize", (category || data.category) === item ? "bg-[#3d2a44] text-[#fbf6ea]" : "bg-elevated")}
            onClick={() => {
              setCategory(item);
              void setAffirmationInterests({ data: { interests: Array.from(new Set([...data.interests, item])) } }).then(() => load(item));
            }}
          >
            {item}
          </button>
        ))}
      </div>
      {data.today ? (
        <blockquote className="mt-4 rounded-3xl bg-gradient-to-br from-[#f4eaf6] to-[#fbf6ea] p-6 font-display text-2xl leading-snug text-[#3d2a44] shadow-[var(--shadow-border)]">
          {data.today.body}
          <div className="mt-4 flex gap-2 font-sans text-sm">
            <Button variant="outline" className="rounded-full" onClick={() => void navigator.clipboard.writeText(data.today?.body || "").then(() => toast.success("Copied"))}>Copy</Button>
            <Button
              variant="ghost"
              onClick={() => data.today?.id && void toggleAffirmationFavorite({ data: { id: data.today.id, favorite: !data.today.favorite } }).then(() => load(category || data.category))}
            >
              {data.today.favorite ? "Saved" : "Save"}
            </Button>
          </div>
        </blockquote>
      ) : null}
      <NoticeToggles />
      {data.history.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {data.history.slice(0, 8).map((row) => (
            <li key={row.id} className="rounded-2xl bg-surface px-3 py-2">{row.body}</li>
          ))}
        </ul>
      ) : null}
    </ToolFrame>
  );
}

export function TimelineTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listTimeline>> | null>(null);
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("milestone");
  const [notes, setNotes] = useState("");
  const [shared, setShared] = useState(false);
  const [happened, setHappened] = useState("");
  async function load() {
    setData(await listTimeline());
  }
  useEffect(() => {
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Private" title="Timeline"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Private" title="Relationship timeline" lede="Only you can see this, unless you mark an entry as shared with a psychic you have already sat with.">
      <form
        className="grid gap-2 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]"
        onSubmit={(event) => {
          event.preventDefault();
          void saveTimelineEvent({ data: { date, title, kind, notes, shared, happened, expected: happened === "" } })
            .then(() => {
              setTitle("");
              setNotes("");
              return load();
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"));
        }}
      >
        <Input type="date" aria-label="Event date" value={date} onChange={(event) => setDate(event.target.value)} required />
        <Input aria-label="Title" placeholder="What happened" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <select aria-label="Kind" className="h-10 rounded-xl bg-elevated px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value)}>
          {TIMELINE_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Textarea aria-label="Notes" placeholder="Optional note" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} /> Share with a psychic I have sat with</label>
        <select aria-label="Did it happen" className="h-10 rounded-xl bg-elevated px-3 text-sm" value={happened} onChange={(event) => setHappened(event.target.value)}>
          <option value="">Not marked</option>
          <option value="yes">It happened</option>
          <option value="no">It did not</option>
          <option value="unknown">Still unknown</option>
        </select>
        <Button className="rounded-full" type="submit">Add to timeline</Button>
      </form>
      <ol className="mt-6 border-l border-[#e6d3a1] pl-4">
        {data.events.map((event) => (
          <li key={event.id} className="relative mb-4">
            <span className="absolute -left-[1.3rem] top-1 size-2.5 rounded-full bg-[#c4a35a]" />
            <p className="text-xs text-muted">{event.date} · {event.kind}{event.shared ? " · shared" : ""}{event.happened ? ` · ${event.happened}` : ""}</p>
            <p className="font-medium">{event.title}</p>
            {event.notes ? <p className="text-sm text-muted">{event.notes}</p> : null}
            <button type="button" className="text-xs text-primary" onClick={() => void deleteTimelineEvent({ data: { id: event.id } }).then(load)}>Delete</button>
          </li>
        ))}
      </ol>
      {!data.events.length ? <p className="text-sm text-muted">Nothing written yet.</p> : null}
    </ToolFrame>
  );
}

export function MoodTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof moodState>> | null>(null);
  const [note, setNote] = useState("");
  async function load() {
    const next = await moodState({ data: { timeZone: zone() } });
    setData(next);
    if (next.state === "ready" && next.today) setNote(next.today.note);
  }
  useEffect(() => {
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load"));
  }, []);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    if (data?.state === "ready") {
      for (const row of data.history) map.set(row.mood, (map.get(row.mood) || 0) + 1);
    }
    return map;
  }, [data]);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Check-in" title="How are you feeling"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Check-in" title="How are you feeling today?" lede="This stays on your account. It is not shared with psychics, and it is not a diagnosis.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MOODS.map((mood) => (
          <button
            key={mood}
            type="button"
            className={cn("min-h-12 rounded-2xl capitalize", data.today?.mood === mood ? "bg-[#3d2a44] text-[#fbf6ea]" : "bg-surface shadow-[var(--shadow-border)]")}
            onClick={() => void saveMood({ data: { mood, note, timeZone: zone() } }).then(load).catch((err) => toast.error(err instanceof Error ? err.message : "Could not save"))}
          >
            {mood}
          </button>
        ))}
      </div>
      <Textarea className="mt-3" aria-label="Optional note" placeholder="Optional private note" value={note} onChange={(event) => setNote(event.target.value)} />
      {data.today ? (
        <article className="mt-4 rounded-3xl bg-[#fbf6ea] p-4 text-sm text-[#3d2a44]">
          <p>{data.today.message}</p>
          <p className="mt-2 text-[#6d5a4a]">{data.today.exercise}</p>
          <p className="mt-2 text-xs">Not a medical assessment. Streak {data.streak} day{data.streak === 1 ? "" : "s"}.</p>
        </article>
      ) : null}
      <h2 className="mt-6 font-display text-xl">This week, counted</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {[...counts.entries()].map(([mood, n]) => (
          <li key={mood} className="flex justify-between capitalize"><span>{mood}</span><span>{n}</span></li>
        ))}
      </ul>
      <ul className="mt-4 space-y-2">
        {data.history.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 rounded-2xl bg-surface px-3 py-2 text-sm">
            <span><span className="text-muted">{row.date}</span> · <span className="capitalize">{row.mood}</span>{row.note ? ` · ${row.note}` : ""}</span>
            <button type="button" className="text-xs text-primary" onClick={() => void deleteMood({ data: { id: row.id } }).then(load)}>Delete</button>
          </li>
        ))}
      </ul>
    </ToolFrame>
  );
}

export function BadgeTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof badgeState>> | null>(null);
  useEffect(() => {
    void badgeState({ data: { timeZone: zone() } }).then(setData).catch((err) => toast.error(err instanceof Error ? err.message : "Could not load badges"));
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Achievements" title="Badges"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Achievements" title="Spiritual badges" lede="These are not Silver, Gold, Diamond, or Crown spending badges, and they never add coins.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.badges.map((badge) => (
          <li key={badge.id} className={cn("rounded-3xl p-4 shadow-[var(--shadow-border)]", badge.earned ? "bg-gradient-to-br from-[#fbf6ea] to-[#f4eaf6]" : "bg-surface opacity-80")}>
            <p className="text-xs tracking-wide text-[#8d6b32] uppercase">{badge.earned ? "Earned" : "Locked"}</p>
            <h2 className="font-display text-2xl">{badge.name}</h2>
            <p className="mt-1 text-sm text-muted">{badge.detail}</p>
            <p className="mt-2 text-xs">{badge.progress} / {badge.target}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eadfca]">
              <div className="h-full bg-[#c4a35a]" style={{ width: `${Math.round((badge.progress / badge.target) * 100)}%` }} />
            </div>
            {badge.earnedAt ? <p className="mt-2 text-xs text-muted">{new Date(badge.earnedAt).toLocaleDateString()}</p> : null}
          </li>
        ))}
      </ul>
    </ToolFrame>
  );
}

export function VaultTool() {
  const [data, setData] = useState<Awaited<ReturnType<typeof listVault>> | null>(null);
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    void listVault().then(setData).catch((err) => toast.error(err instanceof Error ? err.message : "Could not load"));
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Vault" title="Future messages"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Vault" title="Future messages" lede="A psychic can leave a note to open later. Opening it does not cost coins.">
      {!data.messages.length ? <p className="text-sm text-muted">No messages waiting.</p> : null}
      <ul className="space-y-3">
        {data.messages.map((message) => {
          const left = Math.max(0, Date.parse(message.unlockAt) - Date.now());
          const locked = message.status !== "unlocked";
          return (
            <li key={message.id} className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-center gap-3">
                {message.photoUrl ? <img src={message.photoUrl} alt="" className="size-12 rounded-full object-cover" /> : <span className="grid size-12 place-items-center rounded-full bg-[#f4eaf6] text-lg">✉</span>}
                <div>
                  <p className="font-medium">{message.advisorName}</p>
                  <p className="text-xs text-muted">{locked ? `Opens ${new Date(message.unlockAt).toLocaleString()}` : "Open"}</p>
                </div>
              </div>
              {locked ? <p className="mt-3 text-sm text-muted">Locked · {formatLeft(left)}</p> : <p className="mt-3 text-sm leading-relaxed">{message.body}</p>}
              {!locked ? <button type="button" className="mt-2 text-xs text-primary" onClick={() => void deleteVaultMessage({ data: { id: message.id } }).then(() => listVault()).then(setData)}>Delete</button> : null}
            </li>
          );
        })}
      </ul>
    </ToolFrame>
  );
}

function formatLeft(ms: number) {
  const total = Math.ceil(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${total % 60}s`;
}

export function QueueTool({ advisor }: { advisor: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof queueState>> | null>(null);
  async function load() {
    setData(await queueState({ data: { advisorId: advisor } }));
  }
  useEffect(() => {
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Could not load the queue"));
  }, [advisor]);
  if (!data) return <div className="h-40 animate-pulse rounded-3xl bg-elevated" />;
  if (data.state !== "ready") return <ToolFrame kicker="Queue" title="Waiting line"><LockedOrOff state={data.state} plan={data.plan} /></ToolFrame>;
  return (
    <ToolFrame kicker="Queue" title="Waiting line" lede="Joining is free. A session starts only after you accept an invitation and your psychic accepts the request.">
      {advisor ? (
        <Button
          className="rounded-full"
          onClick={() => void joinQueue({ data: { advisorId: advisor } }).then((res) => {
            if (res.state !== "ready") {
              toast.message(res.state === "locked" ? "Ora Membership opens the waiting line." : "The waiting line is off.");
              return;
            }
            toast.success(res.already ? "You are already in line." : "You are in line.");
            return load();
          }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not join"))}
        >
          Advisor Busy – Join Waiting Queue
        </Button>
      ) : <p className="text-sm text-muted">Open a psychic who is in session to join their line.</p>}
      <ul className="mt-4 space-y-3">
        {data.entries.map((entry) => (
          <li key={entry.id} className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="font-medium">{entry.advisorName}</p>
            <p className="text-sm text-muted">
              {entry.status === "offered" ? "It is your turn." : `Position ${entry.position} of ${entry.waiting}`}
              {entry.estimateMinutes ? ` · about ${entry.estimateMinutes} min if recent sittings hold` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              {entry.status === "offered" ? (
                <Button
                  className="rounded-full"
                  onClick={() => void acceptQueueOffer({ data: { id: entry.id } }).then(async (res) => {
                    if (res.state !== "ready") return;
                    if (res.mode === "live" && res.id) await navigate({ to: "/reading/$id", params: { id: res.id } });
                    else if (res.requestId) await navigate({ to: "/wait/$id", params: { id: res.requestId } });
                  }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not accept"))}
                >
                  Accept invitation
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => void leaveQueue({ data: { id: entry.id } }).then(load)}>Leave</Button>
            </div>
          </li>
        ))}
      </ul>
      {!data.entries.length ? <p className="mt-4 text-sm text-muted">You are not waiting for anyone.</p> : null}
    </ToolFrame>
  );
}

export function PremiumHub() {
  const tools = [
    ["love", "Love Compatibility"],
    ["tarot", "Daily Tarot"],
    ["pick", "Pick a Card"],
    ["moon", "Moon Calendar"],
    ["affirm", "Daily Affirmations"],
    ["timeline", "Relationship Timeline"],
    ["mood", "Emotional Check-in"],
    ["badges", "Spiritual Badges"],
    ["vault", "Future Messages"],
    ["queue", "Waiting Queue"],
  ] as const;
  return (
    <main className="px-4 py-6">
      <p className="text-[11px] tracking-[0.16em] text-[#8d6b32] uppercase">Ora Membership</p>
      <h1 className="mt-1 font-display text-4xl">Spiritual tools</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">A private room beside your readings. Mini and free accounts can see the doors. Only Ora Membership can open them.</p>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {tools.map(([id, label]) => (
          <li key={id}>
            <Link to="/spirit/$tool" params={{ tool: id }} search={{ advisor: "" }} className="flex min-h-14 items-center justify-between rounded-2xl bg-surface px-4 shadow-[var(--shadow-border)]">
              <span>{label}</span>
              <span className="text-xs text-[#8d6b32]">Membership</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">{PREMIUM_NOTE}</p>
    </main>
  );
}
