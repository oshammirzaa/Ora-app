import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicPsychic } from "./ora-domains.ts";
import { advisorMatchesCategory, publicCategoryById } from "./ora-public-categories.ts";
import { advisorMatchesPublicCategory, parseReadingListings, requireReadingListings } from "./ora-reading-listings.ts";
import { pageDirectory, parsePsychicSearch, queryPublicDirectory } from "./ora-public-directory.ts";

function psychic(partial: Partial<PublicPsychic> & Pick<PublicPsychic, "id" | "name">): PublicPsychic {
  return {
    slug: partial.id,
    bio: "",
    experience: "",
    specialties: "",
    rateCoins: 20,
    photoUrl: "",
    videoUrl: "",
    status: "live",
    trusted: false,
    isNew: false,
    rating: 0,
    reviews: 0,
    languages: "English",
    years: 1,
    online: false,
    busy: false,
    monthlyRank: null,
    manualRank: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    listingCategories: [],
    ...partial,
  };
}

describe("public advisor discovery", () => {
  const rows = [
    psychic({
      id: "love",
      name: "Amira",
      specialties: "Love and relationships",
      rating: 4.8,
      reviews: 12,
      online: true,
      years: 4,
    }),
    psychic({
      id: "tarot",
      name: "Nila",
      specialties: "Tarot",
      rating: 5,
      reviews: 2,
      online: false,
      years: 9,
      manualRank: 1,
    }),
    psychic({
      id: "career",
      name: "Jon",
      specialties: "Career coaching",
      rating: 4.2,
      reviews: 0,
      online: true,
      busy: true,
      years: 2,
      isNew: true,
      createdAt: "2026-06-01T00:00:00.000Z",
    }),
    psychic({
      id: "palm",
      name: "Reed",
      specialties: "Palm Readings",
      online: true,
      years: 15,
    }),
  ];

  it("matches stored specialties and ignores unknown modes", () => {
    const love = publicCategoryById("love");
    const tarot = publicCategoryById("tarot");
    assert.ok(love && advisorMatchesCategory("Love and relationships", love));
    assert.equal(advisorMatchesCategory("Career coaching", love!), false);
    assert.ok(tarot && advisorMatchesCategory("Tarot", tarot));
    assert.equal(advisorMatchesCategory("Tarot", publicCategoryById("psychic-readings")!), false);
    assert.equal(advisorMatchesCategory("Palm Readings", publicCategoryById("palm")!), true);
    const found = queryPublicDirectory(rows, { category: "love", availability: "online" });
    assert.deepEqual(found.map((row) => row.id), ["love"]);
    assert.deepEqual(queryPublicDirectory(rows, { connect: "chat", q: "nila" }).map((row) => row.id), ["tarot"]);
    assert.deepEqual(queryPublicDirectory(rows, { availability: "busy" }).map((row) => row.id), ["career"]);
    assert.deepEqual(queryPublicDirectory(rows, { board: "new" }).map((row) => row.id), ["career"]);
  });

  it("keeps trusted ranking and does not pad missing advisors", () => {
    const trusted = queryPublicDirectory(rows, { board: "trusted" }, false);
    assert.deepEqual(trusted.map((row) => row.id), ["tarot"]);
    const recommended = queryPublicDirectory(rows, { sort: "recommended" }, false);
    assert.equal(recommended[0]?.id, "love");
    assert.equal(recommended.some((row) => row.id === "career"), true);
    const experienced = queryPublicDirectory(rows, { sort: "experienced" });
    assert.equal(experienced[0]?.id, "palm");
    const page = pageDirectory(experienced, 1, 2);
    assert.equal(page.total, 4);
    assert.equal(page.hasMore, true);
    assert.equal(page.items.length, 2);
  });

  it("drops unsafe search text and fictional connection modes", () => {
    assert.deepEqual(parsePsychicSearch({ q: "<script>", category: "love", board: "trusted", connect: "video" }), {
      board: "trusted",
      category: "love",
    });
    assert.equal(parsePsychicSearch({ availability: "online", sort: "top-rated", connect: "chat" }).connect, "chat");
  });

  it("keeps legacy specialties and limits assigned advisors to two listings", () => {
    const soulmate = publicCategoryById("soulmate");
    const love = publicCategoryById("love");
    const career = publicCategoryById("career");
    const tarot = publicCategoryById("tarot");
    assert.ok(soulmate && love && career && tarot);
    const legacy = psychic({ id: "old", name: "Old", specialties: "Soulmate readings" });
    assert.equal(advisorMatchesPublicCategory(legacy, soulmate!), true);
    assert.equal(advisorMatchesPublicCategory(legacy, love!), true);
    const assigned = psychic({
      id: "new",
      name: "New",
      specialties: "Soulmate, Love & Relationships, Tarot",
      listingCategories: ["soulmate", "love"],
    });
    assert.equal(advisorMatchesPublicCategory(assigned, soulmate!), true);
    assert.equal(advisorMatchesPublicCategory(assigned, love!), true);
    assert.equal(advisorMatchesPublicCategory(assigned, career!), false);
    assert.equal(advisorMatchesPublicCategory(assigned, tarot!), false);
    const listed = queryPublicDirectory(
      [assigned, psychic({ id: "job", name: "Job", specialties: "Career coaching", listingCategories: ["career", "tarot"] })],
      { category: "tarot" },
    );
    assert.deepEqual(listed.map((row) => row.id), ["job"]);
    assert.deepEqual(requireReadingListings(["tarot", "career"]), ["career", "tarot"]);
    assert.throws(() => requireReadingListings(["love"]), /exactly two/);
    assert.deepEqual(parseReadingListings("soulmate,not-real,love"), ["soulmate", "love"]);
  });

  it("shows available trusted advisors before offline ones without dropping rank order", () => {
    const trusted = queryPublicDirectory(
      [
        psychic({ id: "high", name: "High", specialties: "Tarot", manualRank: 1, online: false }),
        psychic({ id: "mid", name: "Mid", specialties: "Tarot", manualRank: 2, online: true, busy: true }),
        psychic({ id: "low", name: "Low", specialties: "Tarot", manualRank: 3, online: true }),
      ],
      { board: "trusted" },
      false,
    );
    assert.deepEqual(trusted.map((row) => row.id), ["low", "mid", "high"]);
  });
});
