import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDayPeriod,
  advisorAcceptsNewLiveRequests,
  customerFloorPresence,
  emptyAdvisorHours,
  isWithinAdvisorSchedule,
  parseHoursJson,
  publicAdvisorPresence,
  scheduleEndsLiveReading,
  serializeHoursJson,
  setDayUnavailable,
  zonedWeekdayAndMinutes,
} from "./ora-advisor-schedule.ts";

function splitDay() {
  const hours = emptyAdvisorHours("America/New_York");
  hours.configured = true;
  hours.mon = {
    on: true,
    start: "09:00",
    end: "13:00",
    periods: [
      { start: "09:00", end: "13:00" },
      { start: "17:00", end: "22:00" },
    ],
  };
  hours.tue = setDayUnavailable(hours.tue);
  return hours;
}

describe("advisor schedule and availability", () => {
  it("keeps unconfigured hours always available when the advisor is manually online", () => {
    const hours = parseHoursJson("");
    assert.equal(hours.configured, false);
    assert.equal(isWithinAdvisorSchedule(hours, Date.parse("2026-09-22T03:00:00Z")), true);
    assert.equal(advisorAcceptsNewLiveRequests({ online: true, hours }).ok, true);
    assert.equal(advisorAcceptsNewLiveRequests({ online: false, hours }).ok, false);
  });

  it("allows multiple working periods on the same day", () => {
    const hours = splitDay();
    const morning = Date.parse("2026-09-21T16:00:00Z");
    const gap = Date.parse("2026-09-21T19:00:00Z");
    const evening = Date.parse("2026-09-21T22:00:00Z");
    assert.equal(zonedWeekdayAndMinutes(morning, "America/New_York").weekday, "mon");
    assert.equal(isWithinAdvisorSchedule(hours, morning), true);
    assert.equal(isWithinAdvisorSchedule(hours, gap), false);
    assert.equal(isWithinAdvisorSchedule(hours, evening), true);
    const extra = addDayPeriod(hours.mon, { start: "23:00", end: "23:30" });
    assert.equal(extra.periods.length, 3);
  });

  it("treats a whole day as unavailable when marked off", () => {
    const hours = splitDay();
    const tuesday = Date.parse("2026-09-22T16:00:00Z");
    assert.equal(zonedWeekdayAndMinutes(tuesday, "America/New_York").weekday, "tue");
    assert.equal(isWithinAdvisorSchedule(hours, tuesday), false);
    assert.equal(advisorAcceptsNewLiveRequests({ online: true, hours, now: tuesday }).ok, false);
  });

  it("blocks new live requests in away mode without clearing the schedule", () => {
    const hours = splitDay();
    const morning = Date.parse("2026-09-21T16:00:00Z");
    assert.equal(advisorAcceptsNewLiveRequests({ online: true, away: true, hours, now: morning }).ok, false);
    assert.equal(isWithinAdvisorSchedule(hours, morning), true);
    assert.equal(hours.mon.on, true);
  });

  it("does not auto-online an advisor who is inside scheduled hours but manually offline", () => {
    const hours = splitDay();
    const morning = Date.parse("2026-09-21T16:00:00Z");
    assert.equal(isWithinAdvisorSchedule(hours, morning), true);
    const gate = advisorAcceptsNewLiveRequests({ online: false, hours, now: morning });
    assert.equal(gate.ok, false);
    assert.match(gate.reason, /offline/i);
    const floor = customerFloorPresence({ online: false, busy: false, hours, now: morning });
    assert.equal(floor.online, false);
  });

  it("converts the advisor timezone so customers are not shown Online on the wrong clock", () => {
    const hours = splitDay();
    const utcLate = Date.parse("2026-09-21T22:30:00Z");
    assert.equal(isWithinAdvisorSchedule(hours, utcLate), true);
    const utcHours = parseHoursJson(serializeHoursJson({ ...hours, timezone: "UTC" }));
    assert.equal(isWithinAdvisorSchedule(utcHours, utcLate), false);
    const ny = zonedWeekdayAndMinutes(utcLate, "America/New_York");
    const utc = zonedWeekdayAndMinutes(utcLate, "UTC");
    assert.notEqual(ny.minutes, utc.minutes);
  });

  it("does not end an active session when scheduled hours finish", () => {
    const hours = splitDay();
    const afterHours = Date.parse("2026-09-21T19:00:00Z");
    assert.equal(scheduleEndsLiveReading(), false);
    assert.equal(isWithinAdvisorSchedule(hours, afterHours), false);
    assert.equal(advisorAcceptsNewLiveRequests({ online: true, hours, now: afterHours }).ok, false);
    const floor = customerFloorPresence({ online: true, busy: true, hours, now: afterHours });
    assert.equal(floor.busy, true);
    assert.equal(floor.online, true);
  });

  it("hides customer Online when away or outside hours even if the advisor left the online toggle on", () => {
    const hours = splitDay();
    const afterHours = Date.parse("2026-09-21T19:00:00Z");
    const hidden = publicAdvisorPresence({
      online: true,
      busy: false,
      away: false,
      hours,
      now: afterHours,
    });
    assert.equal(hidden.online, false);
    const away = publicAdvisorPresence({
      online: true,
      busy: false,
      away: true,
      hours,
      now: Date.parse("2026-09-21T16:00:00Z"),
    });
    assert.equal(away.online, false);
    const live = publicAdvisorPresence({
      online: true,
      busy: false,
      away: false,
      hours,
      now: Date.parse("2026-09-21T16:00:00Z"),
    });
    assert.equal(live.online, true);
  });

  it("round-trips old single-period hours json", () => {
    const hours = parseHoursJson({ mon: { on: true, start: "10:00", end: "18:00" }, tue: { on: false } });
    assert.equal(hours.mon.on, true);
    assert.equal(hours.mon.start, "10:00");
    assert.equal(hours.mon.periods[0]?.end, "18:00");
    const round = parseHoursJson(serializeHoursJson(hours));
    assert.equal(round.configured, true);
    assert.equal(round.mon.end, "18:00");
  });
});
