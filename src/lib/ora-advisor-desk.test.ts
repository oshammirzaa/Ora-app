import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVISOR_FAQ,
  ADVISOR_DAILY_CLIENT_MESSAGES,
  advisorUtcDayKey,
  canClaimDailyMessage,
  dailyMessageQuotaView,
  isDailyOutreachKind,
  answerRate,
  averageOnlineSeconds,
  averageReadingSeconds,
  classifyClient,
  classifyClientBand,
  clientMessageDeniedReason,
  compactClientBuckets,
  completionRate,
  customerIsActive,
  followUpDeniedReason,
  formatBirthDate,
  formatLastConversation,
  formatPaidMinuteValue,
  formatReadingMinutes,
  formatUsdFromCoins,
  formatWait,
  genderLabel,
  includeChatRequestAsOrder,
  isFrequentClient,
  isIncomingRequestFresh,
  joinSpecialties,
  matchesClientKind,
  matchesInboxFilter,
  matchesOrderFilter,
  normalizeGender,
  orderBucket,
  parseBirthDate,
  parseGalleryJson,
  parseHoursJson,
  parseQuickReplies,
  parseSpecialtiesList,
  paidMinutesFromCharge,
  pct,
  formatAdvisorMinuteRate,
  incomingClientInfoView,
  incomingQueueOthers,
  pickActiveIncomingRequest,
  presenceCountedEnd,
  presenceSecondsInWindow,
  remainingDailyClientMessages,
  reminderDueAt,
  reminderFromLocalParts,
  reminderLocalParts,
  reminderBucket,
  groupAdvisorReminders,
  isDuplicateOpenReminder,
  pickDueReminder,
  shouldBrowserNotifyReminder,
  snoozeDueAt,
  repeatClientRate,
  revenueStatus,
  serializeGallery,
  serializeHoursJson,
  serviceTypeLabel,
  shortClientId,
  showIncomingQueue,
  statsWindow,
  summarizeAdvisorDeskWindow,
  summarizeIncomingClientHistory,
  todayClientKind,
  visibleAdvisorPhoto,
  visibleClientGender,
  waitingSeconds,
  walletBillingKind,
  walletBillingLabel,
  windowIncludesNow,
  availabilityLabel,
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
    assert.ok(ADVISOR_FAQ.some((item) => item.a.includes("daily client-message limit of 30")));
  });
});

describe("advisor follow-up and daily client messages", () => {
  it("counts remaining messages against a shared daily cap of 30", () => {
    assert.equal(ADVISOR_DAILY_CLIENT_MESSAGES, 30);
    assert.equal(remainingDailyClientMessages(0), 30);
    assert.equal(remainingDailyClientMessages(12), 18);
    assert.equal(remainingDailyClientMessages(30), 0);
    assert.equal(remainingDailyClientMessages(41), 0);
    assert.equal(canClaimDailyMessage(29), true);
    assert.equal(canClaimDailyMessage(30), false);
    assert.equal(isDailyOutreachKind("message"), true);
    assert.equal(isDailyOutreachKind("followup"), true);
    assert.equal(isDailyOutreachKind("gift"), false);
    assert.equal(isDailyOutreachKind("pay"), false);
    assert.equal(advisorUtcDayKey(new Date("2026-09-21T23:30:00.000Z")), "2026-09-21");
    assert.equal(advisorUtcDayKey(new Date("2026-09-22T00:15:00.000Z")), "2026-09-22");
    const view = dailyMessageQuotaView(12);
    assert.equal(view.sent, 12);
    assert.equal(view.remaining, 18);
    assert.equal(view.limit, 30);
  });

  it("blocks follow-up without a completed reading, a second follow-up, or a spent daily cap", () => {
    assert.equal(
      followUpDeniedReason({ hasEndedSession: false, alreadySent: false, remainingToday: 30 }),
      "Follow-up is only for customers you have already read with.",
    );
    assert.equal(
      followUpDeniedReason({ hasEndedSession: true, alreadySent: true, remainingToday: 30 }),
      "You already sent a follow-up for this reading.",
    );
    assert.match(
      followUpDeniedReason({ hasEndedSession: true, alreadySent: false, remainingToday: 0 }) || "",
      /Daily client message limit/,
    );
    assert.equal(followUpDeniedReason({ hasEndedSession: true, alreadySent: false, remainingToday: 2 }), null);
  });

  it("keeps inbox messages on the same daily allowance and requires a real session", () => {
    assert.equal(
      clientMessageDeniedReason({ hasSession: false, remainingToday: 30 }),
      "You can only message clients you have already read with.",
    );
    assert.match(clientMessageDeniedReason({ hasSession: true, remainingToday: 0 }) || "", /Daily client message limit/);
    assert.equal(clientMessageDeniedReason({ hasSession: true, remainingToday: 1 }), null);
  });
});

describe("advisor desk ops helpers", () => {
  it("derives returning and frequent clients from reading counts", () => {
    assert.equal(classifyClient(1), "first");
    assert.equal(classifyClient(2), "repeat");
    assert.equal(classifyClientBand(1), "first");
    assert.equal(classifyClientBand(2), "returning");
    assert.equal(classifyClientBand(5), "frequent");
    assert.equal(isFrequentClient(4), false);
    assert.equal(isFrequentClient(5), true);
    assert.equal(todayClientKind(0), "new");
    assert.equal(todayClientKind(3), "repeat");
  });

  it("filters client lists without inventing a class", () => {
    assert.equal(matchesClientKind({ repeat: true, frequent: false, favorite: false }, "repeat"), true);
    assert.equal(matchesClientKind({ repeat: false, frequent: false, favorite: true }, "favorites"), true);
    assert.equal(matchesClientKind({ repeat: true, frequent: true, favorite: false }, "frequent"), true);
    assert.equal(matchesClientKind({ repeat: false, frequent: false, favorite: false }, "first"), true);
    assert.equal(matchesClientKind({ repeat: true, frequent: false, favorite: false, favoritedYou: true }, "favoritedYou"), true);
    assert.equal(matchesClientKind({ repeat: true, frequent: false, favorite: false, favoritedYou: false }, "favoritedYou"), false);
    assert.equal(matchesClientKind(true, "repeat"), true);
    const buckets = compactClientBuckets(
      [
        { id: "a", name: "A", readings: 3, repeat: true, favorite: true, favoritedYou: true },
        { id: "a", name: "A dup", readings: 3, repeat: true, favorite: true, favoritedYou: true },
        { id: "b", name: "B", readings: 1, repeat: false, favorite: true, favoritedYou: false },
        { id: "c", name: "C", readings: 4, repeat: true, favorite: false, favoritedYou: true },
      ],
      6,
    );
    assert.equal(buckets.returning.map((c) => c.id).join(","), "a,c");
    assert.equal(buckets.favorites.map((c) => c.id).join(","), "a,b");
    assert.equal(buckets.favoritedYou.map((c) => c.id).join(","), "a,c");
  });

  it("labels wallet billing without exposing dollar totals", () => {
    assert.equal(walletBillingKind({ coins: 0, includedSeconds: 180 }), "included");
    assert.equal(walletBillingKind({ coins: 40, includedSeconds: 0 }), "paid");
    assert.equal(walletBillingKind({ coins: 40, includedSeconds: 60 }), "included");
    assert.equal(walletBillingKind({ coins: 0, includedSeconds: 0 }), "none");
    assert.equal(walletBillingLabel("included"), "Included minutes");
    assert.ok(!/[$]/.test(walletBillingLabel("paid")));
  });

  it("formats waiting time from the request timestamp", () => {
    const now = Date.parse("2026-09-19T12:00:00Z");
    assert.equal(waitingSeconds(new Date(now - 12_000).toISOString(), now), 12);
    assert.equal(formatWait(12), "12s");
    assert.equal(formatWait(90), "1m 30s");
    assert.equal(formatWait(3600), "1h 0m");
  });

  it("stores weekly hours without implying the advisor is online", () => {
    const hours = parseHoursJson({ mon: { on: true, start: "10:00", end: "18:00" }, tue: { on: false } });
    assert.equal(hours.mon.on, true);
    assert.equal(hours.mon.start, "10:00");
    assert.equal(hours.tue.on, false);
    assert.equal(hours.sun.on, false);
    const round = parseHoursJson(serializeHoursJson(hours));
    assert.equal(round.mon.end, "18:00");
  });

  it("computes reminder due dates from presets without storing customer-visible copy", () => {
    const now = Date.parse("2026-09-19T15:00:00Z");
    const tomorrow = reminderDueAt("tomorrow", undefined, now);
    assert.ok(tomorrow);
    assert.ok(tomorrow.getTime() > now);
    assert.ok(tomorrow.getTime() - now <= 2 * 86400000);
    const custom = reminderDueAt("custom", "2026-09-22T09:00:00.000Z", now);
    assert.equal(custom?.toISOString(), "2026-09-22T09:00:00.000Z");
    assert.equal(reminderDueAt("nope"), null);
    const parts = reminderLocalParts("2026-09-22T09:00:00.000Z");
    assert.equal(parts.date, reminderLocalParts(new Date("2026-09-22T09:00:00.000Z")).date);
    const fromParts = reminderFromLocalParts("2026-09-22", "09:00");
    assert.ok(fromParts);
    assert.equal(reminderFromLocalParts("", "09:00"), null);
    const clock = Date.parse("2026-09-21T15:00:00Z");
    assert.equal(reminderBucket({ dueAt: "2026-09-20T12:00:00.000Z" }, clock), "due");
    assert.equal(reminderBucket({ dueAt: new Date(clock).toISOString() }, clock), "due");
    assert.equal(reminderBucket({ dueAt: "2026-09-28T12:00:00.000Z" }, clock), "upcoming");
    assert.equal(reminderBucket({ dueAt: "2026-09-20T12:00:00.000Z", doneAt: "2026-09-21T10:00:00.000Z" }, clock), "completed");
    const grouped = groupAdvisorReminders(
      [
        { dueAt: "2026-09-20T12:00:00.000Z" },
        { dueAt: new Date(clock).toISOString() },
        { dueAt: "2026-09-28T12:00:00.000Z" },
        { dueAt: "2026-09-10T12:00:00.000Z", doneAt: "2026-09-11T12:00:00.000Z" },
      ],
      clock,
    );
    assert.equal(grouped.due.length, 2);
    assert.equal(grouped.upcoming.length, 1);
    assert.equal(grouped.completed.length, 1);
    const twoWeeks = reminderDueAt("14days", undefined, now);
    const month = reminderDueAt("30days", undefined, now);
    assert.ok(twoWeeks && twoWeeks.getTime() > now);
    assert.ok(month && month.getTime() > twoWeeks.getTime());
    const hour = snoozeDueAt("1hour", undefined, clock);
    assert.equal(hour?.toISOString(), new Date(clock + 3600000).toISOString());
    assert.equal(
      isDuplicateOpenReminder(
        { customerId: "c1", note: "check in", dueAt: "2026-09-22T09:00:00.000Z" },
        { customerId: "c1", note: "check in", dueAt: "2026-09-22T09:00:20.000Z" },
      ),
      true,
    );
    assert.equal(
      isDuplicateOpenReminder(
        { customerId: "c1", note: "check in", dueAt: "2026-09-22T09:00:00.000Z" },
        { customerId: "c2", note: "check in", dueAt: "2026-09-22T09:00:00.000Z" },
      ),
      false,
    );
    assert.equal(shouldBrowserNotifyReminder({ notifiedAt: "" }), true);
    assert.equal(shouldBrowserNotifyReminder({ notifiedAt: "2026-09-21T15:00:00.000Z" }), false);
    const picked = pickDueReminder(
      [
        { id: "b", dueAt: "2026-09-21T14:00:00.000Z" },
        { id: "a", dueAt: "2026-09-20T12:00:00.000Z" },
        { id: "c", dueAt: "2026-09-19T12:00:00.000Z", doneAt: "2026-09-19T13:00:00.000Z" },
      ],
      ["a"],
      clock,
    );
    assert.equal(picked?.id, "b");
  });

  it("labels online, busy, and live without implying scheduled hours go online", () => {
    assert.equal(availabilityLabel({ online: false, busy: false }), "Offline");
    assert.equal(availabilityLabel({ online: true, busy: false }), "In service");
    assert.equal(availabilityLabel({ online: true, busy: true }), "Busy");
    assert.equal(availabilityLabel({ online: true, busy: true, live: true }), "In a reading");
  });

  it("hides the incoming queue for independent advisors who are live or busy", () => {
    assert.equal(showIncomingQueue({ live: false, busy: false }), true);
    assert.equal(showIncomingQueue({ live: true, busy: false }), false);
    assert.equal(showIncomingQueue({ live: false, busy: true }), false);
    assert.equal(showIncomingQueue({ live: true, busy: true, house: true }), true);
  });

  it("picks one fresh incoming request and ignores duplicates or expired rows", () => {
    const now = Date.parse("2026-09-21T12:00:00.000Z");
    const older = new Date(now - 20_000).toISOString();
    const newer = new Date(now - 5_000).toISOString();
    const expired = new Date(now - 4 * 60_000).toISOString();
    const picked = pickActiveIncomingRequest(
      [
        { id: "req_b", createdAt: newer },
        { id: "req_a", createdAt: older },
        { id: "req_old", createdAt: expired },
        { id: "req_a", createdAt: older },
      ],
      now,
    );
    assert.equal(picked?.id, "req_a");
    assert.equal(isIncomingRequestFresh(expired, now), false);
    assert.equal(shortClientId("user_abcdefghijklmnop"), "user_abc…mnop");
    const others = incomingQueueOthers(
      [
        { id: "req_a", createdAt: older, name: "A" },
        { id: "req_a", createdAt: older, name: "A" },
        { id: "req_b", createdAt: newer, name: "B" },
        { id: "req_old", createdAt: expired, name: "Old" },
      ],
      "req_a",
      now,
    );
    assert.equal(others.length, 1);
    assert.equal(others[0]?.id, "req_b");
    assert.equal(formatAdvisorMinuteRate(20), "20c/min");
    assert.equal(formatAdvisorMinuteRate(0), "—");
  });
});

describe("advisor client profile fields", () => {
  it("formats a provided birth date and hides empty or invalid ones", () => {
    assert.equal(parseBirthDate("1994-03-09"), "1994-03-09");
    assert.equal(formatBirthDate("1994-03-09"), "March 9, 1994");
    assert.equal(parseBirthDate(""), "");
    assert.equal(parseBirthDate("not-a-date"), "");
    assert.equal(parseBirthDate("2020-02-30"), "");
    assert.equal(parseBirthDate("1899-12-31"), "");
    assert.equal(formatBirthDate(""), "");
    assert.equal(formatBirthDate("2020-02-30"), "");
  });

  it("rejects a future birth date instead of guessing", () => {
    assert.equal(parseBirthDate("2999-01-01"), "");
    assert.equal(formatBirthDate("2999-01-01"), "");
  });

  it("hides unspecified gender so advisors never guess", () => {
    assert.equal(visibleClientGender("female"), "Female");
    assert.equal(visibleClientGender("male"), "Male");
    assert.equal(visibleClientGender("nonbinary"), "Non-binary");
    assert.equal(visibleClientGender("unspecified"), "");
    assert.equal(visibleClientGender(""), "");
    assert.equal(visibleClientGender(undefined), "");
    assert.equal(genderLabel(""), "Prefer not to say");
  });

  it("averages reading time from real seconds and never invents a sitting", () => {
    assert.equal(averageReadingSeconds(324, 1), 324);
    assert.equal(averageReadingSeconds(600, 2), 300);
    assert.equal(averageReadingSeconds(120, 0), 0);
    assert.equal(formatReadingMinutes(324), "5.4 min");
    assert.equal(formatReadingMinutes(14700), "245 min");
    assert.equal(formatReadingMinutes(0), "0 min");
  });

  it("describes last conversation from the real timestamp", () => {
    const now = Date.parse("2026-09-20T12:00:00Z");
    assert.equal(formatLastConversation(new Date(now - 2 * 86400000).toISOString(), now), "2 days ago");
    assert.equal(formatLastConversation(new Date(now - 3600000).toISOString(), now), "1 hour ago");
    assert.equal(formatLastConversation("", now), "");
  });
});

describe("today dashboard billed totals", () => {
  it("counts paid minutes from charged coins at the sitting rate, not session length", () => {
    assert.equal(paidMinutesFromCharge(1000, 20), 50);
    assert.equal(paidMinutesFromCharge(100, 20), 5);
    assert.equal(paidMinutesFromCharge(0, 20), 0);
    assert.equal(paidMinutesFromCharge(40, 0), 0);
    assert.equal(formatPaidMinuteValue(50), "50 min");
    assert.equal(formatPaidMinuteValue(5.4), "5.4 min");
  });

  it("gives the advisor 20% of the successfully charged amount", () => {
    const window = { from: new Date("2026-09-20T00:00:00.000Z"), to: new Date("2026-09-20T23:59:59.000Z") };
    const summary = summarizeAdvisorDeskWindow(
      [
        {
          readingId: "paid",
          customerId: "c1",
          status: "ended",
          startedAt: "2026-09-20T10:00:00.000Z",
          endedAt: "2026-09-20T10:50:00.000Z",
          coinsSpent: 1000,
          rateCoins: 20,
        },
      ],
      window,
    );
    assert.equal(summary.charged, 1000);
    assert.equal(summary.earnings, 200);
    assert.equal(formatUsdFromCoins(summary.charged), "$100.00");
    assert.equal(formatUsdFromCoins(summary.earnings), "$20.00");
    assert.equal(summary.paidMinutes, 50);
    assert.equal(summary.completed, 1);
    assert.equal(summary.newClients, 1);
  });

  it("leaves out promo, gifts, live chats, cancelled sittings, and clawed refunds", () => {
    const window = { from: new Date("2026-09-20T00:00:00.000Z"), to: new Date("2026-09-20T23:59:59.000Z") };
    const summary = summarizeAdvisorDeskWindow(
      [
        {
          readingId: "old",
          customerId: "c1",
          status: "ended",
          startedAt: "2026-09-19T10:00:00.000Z",
          endedAt: "2026-09-19T10:05:00.000Z",
          coinsSpent: 20,
          rateCoins: 20,
        },
        {
          readingId: "promo",
          customerId: "c1",
          status: "ended",
          startedAt: "2026-09-20T09:00:00.000Z",
          endedAt: "2026-09-20T09:03:00.000Z",
          coinsSpent: 0,
          rateCoins: 20,
        },
        {
          readingId: "live",
          customerId: "c2",
          status: "live",
          startedAt: "2026-09-20T11:00:00.000Z",
          endedAt: "",
          coinsSpent: 80,
          rateCoins: 20,
        },
        {
          readingId: "cancel",
          customerId: "c3",
          status: "cancelled",
          startedAt: "2026-09-20T12:00:00.000Z",
          endedAt: "2026-09-20T12:01:00.000Z",
          coinsSpent: 40,
          rateCoins: 20,
        },
        {
          readingId: "refund",
          customerId: "c4",
          status: "ended",
          startedAt: "2026-09-20T13:00:00.000Z",
          endedAt: "2026-09-20T13:10:00.000Z",
          coinsSpent: 200,
          rateCoins: 20,
        },
        {
          readingId: "paid",
          customerId: "c1",
          status: "ended",
          startedAt: "2026-09-20T14:00:00.000Z",
          endedAt: "2026-09-20T14:05:00.000Z",
          coinsSpent: 100,
          rateCoins: 20,
        },
      ],
      window,
      ["refund"],
    );
    assert.equal(summary.completed, 3);
    assert.equal(summary.cancelled, 1);
    assert.equal(summary.paidReadings, 1);
    assert.equal(summary.paidMinutes, 5);
    assert.equal(summary.earnings, 20);
    assert.equal(summary.charged, 100);
    assert.equal(summary.repeatClients, 1);
    assert.equal(summary.newClients, 0);
    assert.equal(summary.totalClients, 1);
  });

  it("counts a customer once and uses extra prior paid readings when history is not in the window rows", () => {
    const window = { from: new Date("2026-09-20T00:00:00.000Z"), to: new Date("2026-09-20T23:59:59.000Z") };
    const twiceToday = summarizeAdvisorDeskWindow(
      [
        {
          readingId: "a",
          customerId: "c1",
          status: "ended",
          startedAt: "2026-09-20T10:00:00.000Z",
          endedAt: "2026-09-20T10:05:00.000Z",
          coinsSpent: 100,
          rateCoins: 20,
        },
        {
          readingId: "b",
          customerId: "c1",
          status: "ended",
          startedAt: "2026-09-20T18:00:00.000Z",
          endedAt: "2026-09-20T18:04:00.000Z",
          coinsSpent: 80,
          rateCoins: 20,
        },
        {
          readingId: "c",
          customerId: "c2",
          status: "ended",
          startedAt: "2026-09-20T12:00:00.000Z",
          endedAt: "2026-09-20T12:02:00.000Z",
          coinsSpent: 40,
          rateCoins: 20,
        },
      ],
      window,
      [],
      ["c1"],
    );
    assert.equal(twiceToday.paidReadings, 3);
    assert.equal(twiceToday.newClients, 1);
    assert.equal(twiceToday.repeatClients, 1);
    assert.equal(twiceToday.totalClients, 2);
    assert.equal(twiceToday.earnings, 44);
  });

  it("returns zeros when the advisor has no billed activity", () => {
    const window = { from: new Date("2026-09-20T00:00:00.000Z"), to: new Date("2026-09-20T23:59:59.000Z") };
    const summary = summarizeAdvisorDeskWindow([], window);
    assert.equal(summary.completed, 0);
    assert.equal(summary.paidMinutes, 0);
    assert.equal(summary.earnings, 0);
    assert.equal(summary.newClients, 0);
    assert.equal(summary.repeatClients, 0);
  });
});

describe("online time from real presence", () => {
  it("counts only the overlap with today and stops a stale open session at last seen", () => {
    const window = { from: new Date("2026-09-20T00:00:00.000Z"), to: new Date("2026-09-20T12:00:00.000Z") };
    const now = new Date("2026-09-20T12:00:00.000Z");
    const seconds = presenceSecondsInWindow(
      [
        {
          startedAt: "2026-09-19T22:00:00.000Z",
          endedAt: "2026-09-20T01:00:00.000Z",
        },
        {
          startedAt: "2026-09-20T08:00:00.000Z",
          endedAt: null,
          lastSeenAt: "2026-09-20T08:10:00.000Z",
        },
      ],
      window,
      { now },
    );
    assert.equal(seconds, 3600 + 10 * 60);
    const liveKeepsCounting = presenceCountedEnd(
      { endedAt: null, lastSeenAt: "2026-09-20T08:10:00.000Z" },
      now,
      { live: true },
    );
    assert.equal(liveKeepsCounting.toISOString(), now.toISOString());
  });
});

describe("incoming request client history", () => {
  it("shows zeros for a first-time client and ignores live or cancelled chats", () => {
    const summary = summarizeIncomingClientHistory([
      {
        status: "live",
        coinsSpent: 80,
        rateCoins: 20,
        startedAt: "2026-09-21T10:00:00.000Z",
        endedAt: "",
      },
      {
        status: "cancelled",
        coinsSpent: 40,
        rateCoins: 20,
        startedAt: "2026-09-20T10:00:00.000Z",
        endedAt: "2026-09-20T10:01:00.000Z",
      },
    ]);
    assert.equal(summary.previousReadings, 0);
    assert.equal(summary.returning, false);
    assert.equal(summary.paidMinutes, 0);
    assert.equal(summary.lastReadingAt, "");
  });

  it("counts completed sittings, last completed time, and paid minutes at the sitting rate", () => {
    const summary = summarizeIncomingClientHistory([
      {
        status: "ended",
        coinsSpent: 100,
        rateCoins: 20,
        startedAt: "2026-09-10T12:00:00.000Z",
        endedAt: "2026-09-10T12:05:00.000Z",
      },
      {
        status: "completed",
        coinsSpent: 0,
        rateCoins: 20,
        startedAt: "2026-09-18T09:00:00.000Z",
        endedAt: "2026-09-18T09:03:00.000Z",
      },
      {
        status: "ended",
        coinsSpent: 40,
        rateCoins: 20,
        startedAt: "2026-09-21T15:00:00.000Z",
        endedAt: "2026-09-21T15:02:00.000Z",
      },
    ]);
    assert.equal(summary.previousReadings, 3);
    assert.equal(summary.returning, true);
    assert.equal(summary.paidMinutes, 7);
    assert.equal(summary.lastReadingAt, "2026-09-21T15:02:00.000Z");
  });

  it("hides empty stats for a new client and shows returning history without other-advisor data", () => {
    const first = incomingClientInfoView({
      returning: false,
      previousReadings: 0,
      lastReadingAt: "2026-01-01T00:00:00.000Z",
      paidMinutes: 12,
      favorited: true,
    });
    assert.equal(first.kind, "new");
    assert.equal(first.label, "New client");
    assert.equal(first.showHistory, false);
    assert.equal(first.previousReadings, 0);
    assert.equal(first.paidMinutes, 0);
    assert.equal(first.favorited, true);
    const again = incomingClientInfoView({
      returning: true,
      previousReadings: 4,
      lastReadingAt: "2026-09-18T09:00:00.000Z",
      paidMinutes: 11.5,
      favorited: true,
    });
    assert.equal(again.kind, "returning");
    assert.equal(again.showHistory, true);
    assert.equal(again.previousReadings, 4);
    assert.equal(again.paidMinutes, 11.5);
    assert.equal(again.favorited, true);
    assert.equal(again.lastReadingAt, "2026-09-18T09:00:00.000Z");
  });
});
