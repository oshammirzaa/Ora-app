import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  alignFeaturedMembership,
  orderByFeaturedRank,
  parseFeaturedRanks,
  planFeaturedCategory,
  writeFeaturedRanks,
} from "./ora-featured-rank.ts";

describe("featured category order", () => {
  it("keeps the saved rank and ignores online status", () => {
    const rows = [
      { id: "b", online: true, featuredRanks: parseFeaturedRanks("trusted:2,premium:1") },
      { id: "a", online: false, featuredRanks: parseFeaturedRanks("trusted:1") },
      { id: "c", online: true, featuredRanks: {} },
    ];
    assert.deepEqual(
      orderByFeaturedRank(rows, "trusted").map((row) => row.id),
      ["a", "b"],
    );
    assert.deepEqual(
      orderByFeaturedRank(rows, "premium").map((row) => row.id),
      ["b"],
    );
  });
});

describe("featured rank persistence", () => {
  it("saves a separate manual order per category and does not follow online status", async () => {
    const pg = new PGlite();
    await pg.exec(`
      create table ora_advisors (
        id text primary key,
        name text not null,
        status text not null,
        online boolean not null default false,
        rating numeric not null default 0,
        reviews integer not null default 0,
        psychic_categories text not null default ''
      );
      create table ora_featured_rank (
        advisor_id text not null,
        category text not null,
        rank integer not null,
        primary key (advisor_id, category)
      );
      create unique index ora_featured_rank_cat_rank_uidx on ora_featured_rank (category, rank);
    `);
    await pg.exec(`
      insert into ora_advisors (id, name, status, online, rating, reviews) values
        ('a', 'Advisor A', 'live', false, 3.1, 1),
        ('b', 'Advisor B', 'live', true, 4.9, 80),
        ('c', 'Advisor C', 'live', true, 5, 40),
        ('paused', 'Paused', 'paused', true, 5, 10);
    `);
    const query = async (text: string, params: unknown[] = []) => (await pg.query(text, params)).rows;

    async function save(category: "trusted" | "premium" | "elite", command: Parameters<typeof planFeaturedCategory>[2]) {
      await pg.transaction(async (tx) => {
        const q = async (text: string, params: unknown[] = []) => (await tx.query(text, params)).rows;
        const planned = await planFeaturedCategory(q, category, command);
        await writeFeaturedRanks(q, category, planned);
      });
    }

    await save("trusted", { type: "set", id: "a", rank: 1 });
    await save("trusted", { type: "set", id: "b", rank: 2 });
    await save("trusted", { type: "set", id: "c", rank: 3 });
    await save("premium", { type: "set", id: "b", rank: 1 });
    await save("elite", { type: "set", id: "c", rank: 1 });
    await save("trusted", { type: "order", ids: ["c", "a", "b"] });

    const stored = (await query(
      `select a.id, a.online, fr.category, fr.rank
       from ora_featured_rank fr
       join ora_advisors a on a.id = fr.advisor_id
       order by fr.category, fr.rank`,
    )) as { id: string; online: boolean; category: string; rank: number }[];
    assert.deepEqual(
      stored.map((row) => [String(row.category), Number(row.rank), String(row.id), Boolean(row.online)]),
      [
        ["elite", 1, "c", true],
        ["premium", 1, "b", true],
        ["trusted", 1, "c", true],
        ["trusted", 2, "a", false],
        ["trusted", 3, "b", true],
      ],
    );

    const packed = (await query(
      `select a.id, a.online,
              coalesce((select string_agg(fr.category || ':' || fr.rank::text, ',') from ora_featured_rank fr where fr.advisor_id = a.id), '') as featured_ranks
       from ora_advisors a
       where a.status = 'live'`,
    )) as { id: string; online: boolean; featured_ranks: string }[];
    const homepage = packed.map((row) => ({
      id: String(row.id),
      online: Boolean(row.online),
      featuredRanks: parseFeaturedRanks(row.featured_ranks),
    }));
    assert.deepEqual(
      orderByFeaturedRank(homepage, "trusted").map((row) => row.id),
      ["c", "a", "b"],
    );
    assert.equal(orderByFeaturedRank(homepage, "trusted")[1]?.online, false);
    assert.deepEqual(
      orderByFeaturedRank(homepage, "premium").map((row) => row.id),
      ["b"],
    );

    await save("trusted", { type: "reset", id: "a" });
    const afterRemove = (await query(
      "select advisor_id from ora_featured_rank where category = 'trusted' order by rank",
    )) as { advisor_id: string }[];
    assert.deepEqual(
      afterRemove.map((row) => String(row.advisor_id)),
      ["c", "b"],
    );
    const ranks = (
      (await query("select rank from ora_featured_rank where category = 'trusted'")) as { rank: number }[]
    ).map((row) => Number(row.rank));
    assert.equal(new Set(ranks).size, ranks.length);

    await alignFeaturedMembership(query, "paused", ["trusted", "premium"]);
    const pausedRanks = await query("select category from ora_featured_rank where advisor_id = 'paused'");
    assert.equal(pausedRanks.length, 0);

    await assert.rejects(
      () => save("trusted", { type: "order", ids: ["c", "c"] }),
      /once/,
    );
  });
});
