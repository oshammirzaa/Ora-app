import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  planManualRanks,
  trustedPsychics,
  writeManualRanks,
  type RankSlot,
  type TrustedAdvisor,
} from "./ora-manual-rank.ts";

function slot(id: string, rank: number | null, active = true): RankSlot {
  return { id, rank, active };
}

function ranksOf(slots: RankSlot[], changes: { id: string; newRank: number | null }[]) {
  const next = new Map(slots.map((row) => [row.id, row.rank]));
  for (const change of changes) next.set(change.id, change.newRank);
  return [...next.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function person(partial: Partial<TrustedAdvisor> & { name: string; online?: boolean; trusted?: boolean }): TrustedAdvisor & {
  name: string;
  online?: boolean;
  trusted?: boolean;
} {
  return { manualRank: null, status: "live", online: false, trusted: false, ...partial };
}

describe("manual advisor ranking", () => {
  it("shifts occupied ranks down and never duplicates them", () => {
    const slots = [slot("sarah", 1), slot("jessica", 2), slot("emily", null)];
    const changes = planManualRanks(slots, { type: "set", id: "emily", rank: 1 });
    assert.deepEqual(ranksOf(slots, changes), [
      ["emily", 1],
      ["jessica", 3],
      ["sarah", 2],
    ]);
    const used = changes.map((change) => change.newRank);
    assert.equal(new Set(used).size, used.length);
  });

  it("rejects a duplicate target and a rank past the end of the list", () => {
    const slots = [slot("sarah", 1), slot("jessica", 2)];
    assert.throws(() => planManualRanks(slots, { type: "set", id: "sarah", rank: 9 }), /1 to 2/);
    assert.throws(
      () => planManualRanks(slots, { type: "order", ids: ["sarah", "sarah"] }),
      /once/,
    );
  });

  it("moves, resets, and compacts without using rating or online state", () => {
    const slots = [slot("emily", 1), slot("sarah", 2), slot("jessica", 3)];
    const down = planManualRanks(slots, { type: "down", id: "emily" });
    assert.deepEqual(ranksOf(slots, down), [
      ["emily", 2],
      ["jessica", 3],
      ["sarah", 1],
    ]);
    const reset = planManualRanks(slots, { type: "reset", id: "sarah" });
    assert.deepEqual(ranksOf(slots, reset), [
      ["emily", 1],
      ["jessica", 2],
      ["sarah", null],
    ]);
  });

  it("saves a dragged order as unique ranks", () => {
    const slots = [slot("sarah", 1), slot("jessica", 2), slot("emily", null)];
    const changes = planManualRanks(slots, { type: "order", ids: ["emily", "jessica", "sarah"] });
    assert.deepEqual(ranksOf(slots, changes), [
      ["emily", 1],
      ["jessica", 2],
      ["sarah", 3],
    ]);
  });

  it("orders Trusted Psychics by manual rank and hides suspended advisors", () => {
    const rows = [
      person({ name: "Sarah", manualRank: 2, online: true, trusted: true }),
      person({ name: "Offline", manualRank: 1, online: false, trusted: true }),
      person({ name: "Suspended", manualRank: 1, online: true, status: "suspended", trusted: true }),
      person({ name: "Unranked", manualRank: null, online: true, trusted: false }),
      person({ name: "Paused", manualRank: 4, online: true, status: "paused", trusted: true }),
    ];
    const shown = trustedPsychics(rows);
    assert.deepEqual(shown.map((row) => row.name), ["Offline", "Sarah"]);
    assert.equal(shown[0]?.online, false);
    assert.equal(shown[0]?.trusted, true);
  });
});

describe("manual rank persistence", () => {
  it("writes unique ranks in a transaction and keeps history after another change", async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table ora_advisors (
        id text primary key,
        name text not null,
        status text not null,
        online boolean not null default false,
        rating numeric not null default 0,
        reviews integer not null default 0,
        manual_rank integer,
        trusted boolean not null default false
      );
      create unique index ora_advisors_manual_rank_uidx on ora_advisors (manual_rank) where manual_rank is not null;
      create table ora_advisor_rank_history (
        id text primary key,
        advisor_id text not null,
        old_rank integer,
        new_rank integer,
        actor_id text not null default '',
        created_at timestamptz not null default now()
      );
    `);
    await pg.exec(`
      insert into ora_advisors (id, name, status, online, rating, reviews, manual_rank, trusted) values
        ('sarah', 'Sarah', 'live', true, 4.9, 20, 1, false),
        ('jessica', 'Jessica', 'live', false, 4.2, 4, 2, false),
        ('emily', 'Emily', 'live', true, 5, 80, null, false),
        ('hidden', 'Hidden', 'suspended', true, 5, 10, null, false),
        ('nora', 'Nora', 'live', true, 4, 3, null, true);
    `);
    const query = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;
    let n = 0;
    const slots = [slot("sarah", 1), slot("jessica", 2), slot("emily", null), slot("hidden", null, false)];
    const first = planManualRanks(slots, { type: "set", id: "emily", rank: 1 });
    await pg.transaction(async (tx) => {
      await tx.query("select id from ora_advisors for update");
      await writeManualRanks(async (text, params) => (await tx.query(text, params)).rows, first, "owner_1", () => `rnk_${n++}`);
    });
    const stored = await query(
      `select id, online, trusted, manual_rank from ora_advisors
       where status = 'live' and manual_rank is not null and manual_rank >= 1
       order by manual_rank asc`,
    );
    assert.deepEqual(
      stored.map((row) => [
        String((row as { id: string }).id),
        Number((row as { manual_rank: number }).manual_rank),
        Boolean((row as { online: boolean }).online),
        Boolean((row as { trusted: boolean }).trusted),
      ]),
      [
        ["emily", 1, true, true],
        ["sarah", 2, true, true],
        ["jessica", 3, false, true],
      ],
    );
    const ranks = stored.map((row) => Number((row as { manual_rank: number }).manual_rank));
    assert.equal(new Set(ranks).size, ranks.length);
    const nora = await query("select manual_rank, trusted from ora_advisors where id = 'nora'");
    assert.equal((nora[0] as { manual_rank: number | null }).manual_rank, null);
    assert.equal(Boolean((nora[0] as { trusted: boolean }).trusted), false);

    const second = planManualRanks(
      [slot("emily", 1), slot("sarah", 2), slot("jessica", 3), slot("hidden", null, false)],
      { type: "order", ids: ["jessica", "emily", "sarah"] },
    );
    await pg.transaction(async (tx) => {
      await writeManualRanks(async (text, params) => (await tx.query(text, params)).rows, second, "owner_1", () => `rnk_${n++}`);
    });
    const again = await query(
      "select id, manual_rank, online from ora_advisors where status = 'live' and manual_rank is not null order by manual_rank",
    );
    assert.deepEqual(
      again.map((row) => String((row as { id: string }).id)),
      ["jessica", "emily", "sarah"],
    );
    assert.equal(Boolean((again[0] as { online: boolean }).online), false);
    const removed = planManualRanks(
      [slot("jessica", 1), slot("emily", 2), slot("sarah", 3), slot("hidden", null, false), slot("nora", null)],
      { type: "reset", id: "sarah" },
    );
    await pg.transaction(async (tx) => {
      await writeManualRanks(async (text, params) => (await tx.query(text, params)).rows, removed, "owner_1", () => `rnk_${n++}`);
    });
    const trusted = await query(
      `select id, trusted from ora_advisors
       where status = 'live' and manual_rank is not null and manual_rank >= 1
       order by manual_rank asc`,
    );
    assert.deepEqual(
      trusted.map((row) => String((row as { id: string }).id)),
      ["jessica", "emily"],
    );
    const sarah = await query("select manual_rank, trusted, online from ora_advisors where id = 'sarah'");
    assert.equal((sarah[0] as { manual_rank: number | null }).manual_rank, null);
    assert.equal(Boolean((sarah[0] as { trusted: boolean }).trusted), false);
    assert.equal(Boolean((sarah[0] as { online: boolean }).online), true);
    const history = await query("select advisor_id, old_rank, new_rank from ora_advisor_rank_history order by id");
    assert.ok(history.length >= 4);
    assert.ok(history.some((row) => (row as { advisor_id: string }).advisor_id === "emily" && Number((row as { new_rank: number }).new_rank) === 1));
  });
});
