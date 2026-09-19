import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVISOR_FAQ,
  answerRate,
  averageOnlineSeconds,
  classifyClient,
  completionRate,
  customerIsActive,
  genderLabel,
  includeChatRequestAsOrder,
  joinSpecialties,
  matchesClientKind,
  matchesInboxFilter,
  matchesOrderFilter,
  normalizeGender,
  orderBucket,
  parseGalleryJson,
  parseQuickReplies,
  parseSpecialtiesList,
  pct,
  repeatClientRate,
  revenueStatus,
  serializeGallery,
  serviceTypeLabel,
  statsWindow,
  visibleAdvisorPhoto,
  windowIncludesNow,
} from "./ora-advisor-desk-stats.ts";


describe("orderBucket", () => {
  it("maps requests and readings into order filters", () => {
    assert.equal(orderBucket({ kind: "request", status: "pending" }), "pending");
    assert.equal(orderBucket({ kind: "request", status: "accepted" }), "progress");
    assert.equal(orderBucket({ kind: "request", status: "declined" }), "cancelled");
    assert.equal(orderBucket({ kind: "request", status: "expired" }), "cancelled");
    assert.equal(orderBucket({ kind: "reading", status: "live" }), "progress");
    assert.equal(orderBucket({ kind: "reading", status: "ended" }), "completed");
    assert.equal(orderBucket({ kind: "reading", status: "cancelled" }), "cancelled");
  });

  it("does not treat unknown rows as All", () => {
    assert.equal(matchesOrderFilter("other", "all"), false);
    assert.equal(matchesOrderFilter("pending", "all"), true);
    assert.equal(matchesOrderFilter("pending", "pending"), true);
    assert.equal(matchesOrderFilter("completed", "pending"), false);
  });

  it("keeps pending/cancelled requests and drops accepted ones that already have a reading", () => {
    assert.equal(includeChatRequestAsOrder("pending", ""), true);
    assert.equal(includeChatRequestAsOrder("declined", "rd_1"), true);
    assert.equal(includeChatRequestAsOrder("accepted", "rd_1"), false);
    assert.equal(includeChatRequestAsOrder("accepted", ""), true);
  });
});

describe("rates", () => {
  it("returns null instead of fake percentages when there is no sample", () => {
    assert.equal(answerRate(0, 0), null);
    assert.equal(completionRate(0, 0), null);
    assert.equal(repeatClientRate(0, 0), null);
    assert.equal(pct(1, 0), null);
  });

  it("computes real rates from counts", () => {
    assert.equal(answerRate(3, 1), 75);
    assert.equal(completionRate(8, 2), 80);
    assert.equal(repeatClientRate(2, 5), 40);
    assert.equal(averageOnlineSeconds(3600, 2), 1800);
    assert.equal(averageOnlineSeconds(100, 0), 0);
  });
});

describe("inbox filters", () => {
  it("filters unread, paying, and recently active threads", () => {
    assert.equal(matchesInboxFilter({ unread: 2, paying: false, active: false }, "unread"), true);
    assert.equal(matchesInboxFilter({ unread: 0, paying: true, active: false }, "paying"), true);
    assert.equal(matchesInboxFilter({ unread: 0, paying: false, active: true }, "online"), true);
    assert.equal(matchesInboxFilter({ unread: 0, paying: false, active: false }, "online"), false);
  });

  it("treats a client as active only inside the recency window", () => {
    const now = Date.parse("2026-09-18T10:00:00.000Z");
    assert.equal(customerIsActive("2026-09-18T09:57:00.000Z", now), true);
    assert.equal(customerIsActive("2026-09-18T09:50:00.000Z", now), false);
    assert.equal(customerIsActive(null, now), false);
  });
});

describe("clients", () => {
  it("filters first-time versus repeat", () => {
    assert.equal(matchesClientKind(true, "repeat"), true);
    assert.equal(matchesClientKind(false, "repeat"), false);
    assert.equal(matchesClientKind(false, "first"), true);
    assert.equal(matchesClientKind(true, "all"), true);
  });
});

describe("statsWindow", () => {
  it("uses a specific UTC day when provided", () => {
    const { from, to } = statsWindow("week", new Date("2026-09-18T15:00:00.000Z"), "2026-09-12");
    assert.equal(from?.toISOString(), "2026-09-12T00:00:00.000Z");
    assert.equal(to.toISOString(), "2026-09-13T00:00:00.000Z");
  });

  it("opens an all-time window without a start bound", () => {
    const { from } = statsWindow("all", new Date("2026-09-18T00:00:00.000Z"));
    assert.equal(from, null);
  });

  it("does not count live seconds against a past day", () => {
    const { from, to } = statsWindow("day", new Date("2026-09-18T15:00:00.000Z"), "2026-09-12");
    assert.equal(windowIncludesNow(from, to, Date.parse("2026-09-18T15:00:00.000Z")), false);
    assert.equal(windowIncludesNow(from, to, Date.parse("2026-09-12T12:00:00.000Z")), true);
  });
});

describe("labels", () => {
  it("keeps Ora language for service and revenue status", () => {
    assert.equal(serviceTypeLabel("request", "pending"), "Live text chat request");
    assert.equal(serviceTypeLabel("reading", "live"), "Live text chat");
    assert.equal(revenueStatus("live"), "In progress");
    assert.equal(revenueStatus("ended"), "Completed");
    assert.equal(classifyClient(1), "first");
    assert.equal(classifyClient(2), "repeat");
  });
});

describe("advisor profile extras", () => {
  it("normalizes gender without inventing a value", () => {
    assert.equal(normalizeGender("Female"), "female");
    assert.equal(normalizeGender("non-binary"), "nonbinary");
    assert.equal(normalizeGender(""), "unspecified");
    assert.equal(genderLabel("male"), "Male");
    assert.equal(genderLabel(""), "Prefer not to say");
  });

  it("keeps only safe gallery media and serializes it", () => {
    const parsed = parseGalleryJson(
      JSON.stringify([
        { id: "p1", kind: "photo", src: "/images/lila.jpg" },
        { kind: "video", src: "javascript:alert(1)" },
        { kind: "photo", src: "not-a-url" },
        { kind: "video", url: "https://youtu.be/abcdefghijk" },
      ]),
    );
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].kind, "photo");
    assert.equal(parsed[1].kind, "video");
    assert.equal(JSON.parse(serializeGallery(parsed)).length, 2);
  });

  it("joins selected specialties without duplicates", () => {
    assert.deepEqual(parseSpecialtiesList("Love, Career / Grief"), ["Love", "Career", "Grief"]);
    assert.equal(joinSpecialties(["Love", "Love", "Astrology"]), "Love, Astrology");
  });

  it("dedupes canned replies and ignores empty ones", () => {
    assert.deepEqual(parseQuickReplies(["  Hello  ", "", "hello", "I'm with you now."]), ["Hello", "I'm with you now."]);
  });

  it("shows uploaded data URLs on the desk photo", () => {
    assert.equal(visibleAdvisorPhoto("/images/lila.jpg"), "/images/lila.jpg");
    assert.equal(visibleAdvisorPhoto("data:image/jpeg;base64,abc"), "data:image/jpeg;base64,abc");
    assert.equal(visibleAdvisorPhoto("blob:foo"), "");
  });

  it("keeps FAQ copy in Ora language", () => {
    assert.ok(ADVISOR_FAQ.length >= 4);
    assert.ok(ADVISOR_FAQ.some((item) => item.a.includes("20%")));
  });
});
