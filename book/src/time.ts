// Time helpers. Bookings are stored in UTC; businesses think in their own time zone.

export const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";

/** Minutes that `tz` is ahead of UTC at the given instant. */
export function tzOffsetMin(at: Date, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** The instant when the clock in `tz` shows `date` (YYYY-MM-DD) plus `minutes` after midnight. */
export function localToUtc(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - tzOffsetMin(new Date(guess), tz) * 60000;
  t = guess - tzOffsetMin(new Date(t), tz) * 60000; // second pass settles daylight-saving edges
  return new Date(t);
}

/** Calendar date and weekday (0 = Sunday) in `tz` for an instant. */
export function localDate(at: Date, tz: string): { date: string; weekday: number } {
  const shifted = new Date(at.getTime() + tzOffsetMin(at, tz) * 60000);
  return { date: shifted.toISOString().slice(0, 10), weekday: shifted.getUTCDay() };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const weekdayOf = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));

export const minToLabel = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const labelToMin = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? +m[1] * 60 + +m[2] : NaN; };

export const fmtDay = (at: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(at);
export const fmtTime = (at: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
export const fmtDayLong = (at: Date, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(at);

export type Busy = { start: number; end: number };
export type Slot = { minutes: number; label: string; startsAt: string; endsAt: string };

/** Free start times on one local day. A slot is free if the whole service fits inside opening
 *  hours, starts after the notice period, and overlaps no existing booking. */
export function slotsForDay(o: {
  date: string; tz: string; open: number | null; close: number | null;
  durationMin: number; stepMin: number; busy: Busy[]; now: number; noticeHours: number;
}): Slot[] {
  if (o.open == null || o.close == null) return [];
  const out: Slot[] = [];
  const earliest = o.now + o.noticeHours * 3600_000;
  for (let m = o.open; m + o.durationMin <= o.close; m += o.stepMin) {
    const start = localToUtc(o.date, m, o.tz).getTime();
    const end = start + o.durationMin * 60000;
    if (start < earliest) continue;
    if (o.busy.some((b) => start < b.end && end > b.start)) continue;
    out.push({ minutes: m, label: minToLabel(m), startsAt: iso(new Date(start)), endsAt: iso(new Date(end)) });
  }
  return out;
}
