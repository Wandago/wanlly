// Booking logic shared by the public pages, the dashboard and the scheduled job.
import { fill, sendMail } from "./mail";
import { addDays, fmtDayLong, fmtTime, iso, localToUtc, slotsForDay, weekdayOf, type Slot } from "./time";
import type { Business, Env, PayMethod, Service } from "./types";

/** Free slots for each of `days` local dates starting at `from`, using one bookings query. */
export async function rangeSlots(env: Env, biz: Business, service: Service, from: string, days: number, now = Date.now()): Promise<Map<string, Slot[] | null>> {
  const startUtc = iso(localToUtc(from, 0, biz.timezone));
  const endUtc = iso(localToUtc(addDays(from, days), 0, biz.timezone));
  const [hours, busyRows] = await Promise.all([
    env.DB.prepare("SELECT weekday, open_min, close_min FROM hours WHERE business_id = ?").bind(biz.id).all<{ weekday: number; open_min: number; close_min: number }>(),
    env.DB.prepare("SELECT starts_at, ends_at FROM bookings WHERE business_id = ? AND status = 'confirmed' AND starts_at < ? AND ends_at > ?").bind(biz.id, endUtc, startUtc).all<{ starts_at: string; ends_at: string }>(),
  ]);
  const byDay = new Map(hours.results.map((h) => [h.weekday, h]));
  const busy = busyRows.results.map((b) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) }));
  const out = new Map<string, Slot[] | null>();
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const h = byDay.get(weekdayOf(date));
    // null means closed that day; an empty list means open but fully booked (or too soon).
    out.set(date, h ? slotsForDay({ date, tz: biz.timezone, open: h.open_min, close: h.close_min, durationMin: service.duration_min, stepMin: biz.slot_minutes, busy, now, noticeHours: biz.notice_hours }) : null);
  }
  return out;
}

export const payMethods = (env: Env, bizId: number) =>
  env.DB.prepare("SELECT id, kind, label, details, instructions FROM payment_methods WHERE business_id = ? ORDER BY sort, id").bind(bizId).all<PayMethod>().then((r) => r.results);

export const payText = (methods: PayMethod[]) =>
  methods.length ? "How to pay:\n" + methods.map((m) => `- ${m.label}${m.details ? `: ${m.details}` : ""}${m.instructions ? ` (${m.instructions})` : ""}`).join("\n") : "";

type Row = {
  id: number; starts_at: string; manage_token: string; status: string;
  service: string; client_name: string; client_email: string; marketing_ok: number;
  enabled: number | null; subject: string | null; body: string | null;
} & Business;

/** Sends one kind of email for a booking, at most once. Returns what happened. */
export async function sendBookingEmail(env: Env, bookingId: number, kind: "confirmation" | "reminder" | "followup"): Promise<string> {
  const r = await env.DB.prepare(
    `SELECT b.id AS id, b.starts_at, b.manage_token, b.status, s.name AS service, c.name AS client_name, c.email AS client_email, c.marketing_ok,
            es.enabled, es.subject, es.body,
            z.id AS biz_id, z.slug, z.name, z.industry, z.tagline, z.about, z.address, z.phone, z.whatsapp, z.contact_email, z.currency, z.timezone, z.brand, z.slot_minutes, z.notice_hours
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN clients c ON c.id = b.client_id JOIN businesses z ON z.id = b.business_id
     LEFT JOIN email_settings es ON es.business_id = b.business_id AND es.kind = ?
     WHERE b.id = ?`).bind(kind, bookingId).first<Row & { biz_id: number }>();
  if (!r || !r.enabled || !r.subject || !r.body) return "off";
  if (kind === "followup" && !r.marketing_ok) return "no-consent";
  const claimed = await env.DB.prepare("INSERT OR IGNORE INTO email_log (booking_id, kind, status) VALUES (?, ?, 'sending')").bind(bookingId, kind).run();
  if (!claimed.meta.changes) return "already-sent";

  const at = new Date(r.starts_at);
  const vars = {
    name: r.client_name.split(" ")[0], service: r.service, business: r.name, address: r.address,
    date: fmtDayLong(at, r.timezone), time: fmtTime(at, r.timezone),
    payment: payText(await payMethods(env, r.biz_id)),
    manage: `${env.APP_URL}/${r.slug}/booking/${r.manage_token}`, link: `${env.APP_URL}/${r.slug}`,
  };
  let text = fill(r.body, vars);
  if (kind === "followup") text += `\n\n--\nDon't want these emails? Stop them here: ${env.APP_URL}/${r.slug}/unsubscribe/${r.manage_token}`;
  const status = await sendMail(env, { to: r.client_email, subject: fill(r.subject, vars), text, fromName: r.name, replyTo: r.contact_email || undefined });
  await env.DB.prepare("UPDATE email_log SET status = ? WHERE booking_id = ? AND kind = ?").bind(status, bookingId, kind).run();
  return status;
}

/** Scheduled job: sends due reminders and follow-ups. Capped per run to stay inside email limits. */
export async function runEmailJobs(env: Env, limit = 40): Promise<{ reminders: number; followups: number }> {
  const stamp = "strftime('%Y-%m-%dT%H:%M:%SZ','now'";
  const reminders = await env.DB.prepare(
    `SELECT b.id FROM bookings b JOIN email_settings es ON es.business_id = b.business_id AND es.kind = 'reminder' AND es.enabled = 1
     WHERE b.status = 'confirmed' AND b.starts_at > ${stamp}) AND b.starts_at <= ${stamp}, '+' || es.offset_hours || ' hours')
       AND b.created_at < ${stamp}, '-1 hours')
       AND NOT EXISTS (SELECT 1 FROM email_log l WHERE l.booking_id = b.id AND l.kind = 'reminder')
     ORDER BY b.starts_at LIMIT ?`).bind(limit).all<{ id: number }>();
  const followups = await env.DB.prepare(
    `SELECT b.id FROM bookings b JOIN email_settings es ON es.business_id = b.business_id AND es.kind = 'followup' AND es.enabled = 1
     JOIN clients c ON c.id = b.client_id AND c.marketing_ok = 1
     WHERE b.status IN ('confirmed','completed') AND b.ends_at <= ${stamp}, '-' || es.offset_hours || ' hours')
       AND b.ends_at > ${stamp}, '-60 days')
       AND NOT EXISTS (SELECT 1 FROM email_log l WHERE l.booking_id = b.id AND l.kind = 'followup')
     ORDER BY b.ends_at LIMIT ?`).bind(limit).all<{ id: number }>();
  for (const r of reminders.results) await sendBookingEmail(env, r.id, "reminder");
  for (const r of followups.results) await sendBookingEmail(env, r.id, "followup");
  return { reminders: reminders.results.length, followups: followups.results.length };
}
