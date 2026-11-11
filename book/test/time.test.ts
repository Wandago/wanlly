import { describe, expect, it } from "vitest";
import { addDays, localDate, localToUtc, slotsForDay, tzOffsetMin } from "../src/time";

describe("time zones", () => {
  it("Nairobi is 3 hours ahead of UTC", () => {
    expect(tzOffsetMin(new Date("2026-11-12T00:00:00Z"), "Africa/Nairobi")).toBe(180);
    expect(localToUtc("2026-11-12", 9 * 60, "Africa/Nairobi").toISOString()).toBe("2026-11-12T06:00:00.000Z");
  });
  it("handles daylight saving (London summer and winter)", () => {
    expect(localToUtc("2026-07-01", 9 * 60, "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(localToUtc("2026-12-01", 9 * 60, "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
  it("local date rolls over at local midnight", () => {
    expect(localDate(new Date("2026-11-12T22:30:00Z"), "Africa/Nairobi")).toEqual({ date: "2026-11-13", weekday: 5 });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("slotsForDay", () => {
  const base = { date: "2026-11-12", tz: "Africa/Nairobi", open: 9 * 60, close: 12 * 60, durationMin: 60, stepMin: 30, noticeHours: 2, now: Date.parse("2026-11-10T00:00:00Z") };
  it("offers every step where the service fits before closing", () => {
    expect(slotsForDay({ ...base, busy: [] }).map((s) => s.label)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
  it("is empty on a closed day", () => {
    expect(slotsForDay({ ...base, open: null, close: null, busy: [] })).toEqual([]);
  });
  it("removes times that overlap a booking", () => {
    const busy = [{ start: Date.parse("2026-11-12T07:00:00Z"), end: Date.parse("2026-11-12T08:00:00Z") }]; // 10:00-11:00 local
    expect(slotsForDay({ ...base, busy }).map((s) => s.label)).toEqual(["09:00", "11:00"]);
  });
  it("respects the notice period", () => {
    const now = Date.parse("2026-11-12T06:30:00Z"); // 09:30 local, 2h notice means 11:30 earliest
    expect(slotsForDay({ ...base, busy: [], now }).map((s) => s.label)).toEqual([]);
    expect(slotsForDay({ ...base, busy: [], now, noticeHours: 1 }).map((s) => s.label)).toEqual(["10:30", "11:00"]);
  });
});
