import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { HuntShell } from "@/components/hunt-shell";
import { Button } from "@/components/ui/button";
import { PLATFORMS, STATUSES, type LeadStatus } from "@/lib/catalog";
import { useEmber } from "@/lib/store";
import { cn, formatDate } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/leads")({ component: LeadsPage });

function LeadsPage() {
  const leads = useEmber((s) => s.leads);
  const updateLead = useEmber((s) => s.updateLead);
  const removeLead = useEmber((s) => s.removeLead);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const shown = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <HuntShell>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl">Leads</h1>
        <p className="mt-2 text-sm text-muted">
          People you saved from the hunt.{" "}
          <Link to="/" className="text-primary">
            Find more
          </Link>
          .
        </p>
        <div className="mt-5 flex gap-1 overflow-x-auto pb-1">
          {([{ id: "all" as const, label: "All" }, ...STATUSES]).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(s.id)}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm whitespace-nowrap",
                filter === s.id ? "bg-fg text-bg" : "bg-elevated text-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ul className="mt-5 space-y-3">
          {shown.length === 0 ? (
            <li className="rounded-xl bg-surface p-8 text-center text-sm text-muted">
              No leads in this column. Hunt and tap Save lead.
            </li>
          ) : (
            shown.map((l) => (
              <li key={l.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="break-all text-sm text-muted">{l.contact}</p>
                    <p className="mt-1 text-xs text-faint">
                      {PLATFORMS.find((p) => p.id === l.platform)?.label} · {formatDate(l.createdAt)}
                    </p>
                  </div>
                  <select
                    className="h-11 rounded-md bg-elevated px-3 text-sm"
                    value={l.status}
                    onChange={(e) => updateLead(l.id, { status: e.target.value as LeadStatus })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                {l.notes ? <p className="mt-3 text-sm text-muted">{l.notes}</p> : null}
                <div className="mt-3 flex gap-2">
                  {l.contact.startsWith("http") ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={l.contact} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => removeLead(l.id)}>
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </main>
    </HuntShell>
  );
}
