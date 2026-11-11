/** The signed-in dashboard: /app and /app/:slug/... */
import { Hono, type Context } from "hono";
import { isEmail, normEmail } from "./auth";
import { payMethods, sendBookingEmail } from "./booking";
import { sendMail } from "./mail";
import { BRANDS, CURRENCIES, DEFAULT_EMAILS, INDUSTRIES, PAYMENT_KINDS, TIMEZONES, industryOf } from "./templates";
import { fmtDay, fmtTime, iso, labelToMin, localDate, localToUtc, addDays, minToLabel } from "./time";
import type { Business, Env, Service, User, Vars } from "./types";
import { AppShell, canManage, Flash, Logo, Page } from "./ui";

type V = Vars & { biz: Business; role: string };
type C = Context<{ Bindings: Env; Variables: V }>;
export const dash = new Hono<{ Bindings: Env; Variables: V }>();

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, dflt: number) => { const n = parseInt(str(v), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };
const RESERVED = new Set(["app", "login", "logout", "auth", "api", "admin", "static", "www", "book", "help", "about", "terms", "privacy", "pricing", "blog", "support", "settings", "new"]);
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ROLES: Record<string, string> = { owner: "Owner", manager: "Manager", staff: "Staff", desk: "Front desk" };

dash.use("*", async (c, next) => { if (!c.get("user")) return c.redirect("/login"); await next(); });

/* ---------- choose or create a business ---------- */
dash.get("/", async (c) => {
  const user = c.get("user")!;
  const rows = await c.env.DB.prepare("SELECT b.slug, b.name, m.role FROM businesses b JOIN members m ON m.business_id = b.id WHERE m.user_id = ? ORDER BY b.name").bind(user.id).all<{ slug: string; name: string; role: string }>();
  if (rows.results.length === 0) return c.redirect("/app/new");
  if (rows.results.length === 1) return c.redirect(`/app/${rows.results[0].slug}`);
  return c.html(<Page title="Your businesses · Wanlly Book"><div class="narrow"><Logo href="/app" />
    <h1 style="margin:24px 0 14px">Your businesses</h1>
    {rows.results.map((b) => <a class="svc" style="margin-bottom:8px" href={`/app/${b.slug}`}><span class="t"><b>{b.name}</b><small>{ROLES[b.role] ?? b.role}</small></span><span class="p">Open</span></a>)}
    <a class="btn" href="/app/new" style="margin-top:8px">Add another business</a></div></Page>);
});

const NewForm = (p: { err?: string; v?: Record<string, string>; email: string }) => (
  <Page title="Set up your business · Wanlly Book"><div class="narrow" style="max-width:560px"><Logo href="/app" />
    <h1 style="margin:24px 0 6px">Set up your booking page</h1>
    <p class="muted" style="margin-bottom:20px">It takes a minute, and you can change everything later.</p>
    <Flash err={p.err} />
    <form method="post" action="/app/new" class="card">
      <div class="field"><label for="name">Business name</label><input type="text" id="name" name="name" required maxlength={80} value={p.v?.name} data-slug-from /></div>
      <div class="field"><label for="slug">Your link</label><input type="text" id="slug" name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]" maxlength={40} value={p.v?.slug} data-slug />
        <div class="hint">book.wanlly.africa/<b>your-link</b>. Lowercase letters, numbers and dashes.</div></div>
      <div class="field"><label for="industry">What kind of business is it?</label>
        <select id="industry" name="industry">{Object.entries(INDUSTRIES).map(([k, i]) => <option value={k} selected={p.v?.industry === k}>{i.label}</option>)}</select>
        <div class="hint">This sets the wording and gives you starter services and emails.</div></div>
      <div class="row">
        <div class="field"><label for="currency">Currency</label><select id="currency" name="currency">{CURRENCIES.map((x) => <option selected={(p.v?.currency ?? "KES") === x}>{x}</option>)}</select></div>
        <div class="field"><label for="timezone">Time zone</label><select id="timezone" name="timezone">{TIMEZONES.map((x) => <option selected={(p.v?.timezone ?? "Africa/Nairobi") === x}>{x}</option>)}</select></div>
      </div>
      <button class="btn pri block">Create my booking page</button>
      <p class="hint" style="margin-top:10px">Signed in as {p.email}. Wanlly Book is free and never handles your customers' payments.</p>
    </form></div><script src="/app.js" defer></script></Page>
);
dash.get("/new", (c) => c.html(<NewForm email={c.get("user")!.email} />));
dash.post("/new", async (c) => {
  const user = c.get("user")!, f = await c.req.parseBody();
  const v = { name: str(f.name, 80), slug: str(f.slug, 40).toLowerCase(), industry: str(f.industry, 20), currency: str(f.currency, 3), timezone: str(f.timezone, 40) };
  const fail = (err: string) => c.html(<NewForm err={err} v={v} email={user.email} />, 400);
  if (v.name.length < 2) return fail("Please enter your business name.");
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(v.slug) || RESERVED.has(v.slug)) return fail("That link isn't available. Use 3 to 40 lowercase letters, numbers or dashes.");
  if (!INDUSTRIES[v.industry]) v.industry = "other";
  if (!CURRENCIES.includes(v.currency)) v.currency = "KES";
  if (!TIMEZONES.includes(v.timezone)) v.timezone = "Africa/Nairobi";
  const owned = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE user_id = ? AND role = 'owner'").bind(user.id).first<{ n: number }>();
  if ((owned?.n ?? 0) >= 5) return fail("You can own up to 5 businesses on one account.");
  const made = await c.env.DB.prepare("INSERT OR IGNORE INTO businesses (slug, name, industry, currency, timezone, contact_email) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(v.slug, v.name, v.industry, v.currency, v.timezone, user.email).first<{ id: number }>();
  if (!made) return fail("That link is already taken. Try another.");
  const ind = industryOf(v.industry), id = made.id, db = c.env.DB;
  await db.batch([
    db.prepare("INSERT INTO members (business_id, user_id, role) VALUES (?, ?, 'owner')").bind(id, user.id),
    ...ind.services.map(([name, group, min], i) => db.prepare("INSERT INTO services (business_id, name, group_name, duration_min, sort) VALUES (?, ?, ?, ?, ?)").bind(id, name, group, min, i)),
    ...[1, 2, 3, 4, 5, 6].map((d) => db.prepare("INSERT INTO hours (business_id, weekday, open_min, close_min) VALUES (?, ?, ?, ?)").bind(id, d, 9 * 60, d === 6 ? 14 * 60 : 18 * 60)),
    db.prepare("INSERT INTO email_settings (business_id, kind, offset_hours, subject, body) VALUES (?, 'confirmation', 0, ?, ?)").bind(id, DEFAULT_EMAILS.confirmation.subject, DEFAULT_EMAILS.confirmation.body),
    db.prepare("INSERT INTO email_settings (business_id, kind, offset_hours, subject, body) VALUES (?, 'reminder', ?, ?, ?)").bind(id, DEFAULT_EMAILS.reminder.offset, DEFAULT_EMAILS.reminder.subject, DEFAULT_EMAILS.reminder.body),
    db.prepare("INSERT INTO email_settings (business_id, kind, offset_hours, subject, body) VALUES (?, 'followup', ?, ?, ?)").bind(id, ind.followupDays * 24, ind.followupSubject, ind.followupBody),
  ]);
  return c.redirect(`/app/${v.slug}/services?ok=${encodeURIComponent("Your booking page is live. Add your prices, then set how you'd like to be paid.")}`);
});

/* ---------- everything below is inside one business ---------- */
const SETTINGS = new Set(["services", "hours", "payments", "emails", "page", "team"]);
dash.use("/:slug/*", async (c, next) => { await guard(c, next); });
dash.use("/:slug", async (c, next) => { await guard(c, next); });
async function guard(c: C, next: () => Promise<void>) {
  const slug = c.req.param("slug");
  if (slug === "new") return next();
  const row = await c.env.DB.prepare("SELECT b.*, m.role FROM businesses b JOIN members m ON m.business_id = b.id WHERE b.slug = ? AND m.user_id = ?").bind(slug, c.get("user")!.id).first<Business & { role: string }>();
  if (!row) { c.res = await c.notFound(); return; }
  const section = new URL(c.req.url).pathname.split("/")[3] ?? "";
  if (SETTINGS.has(section) && (!canManage(row.role) || (section === "team" && row.role !== "owner"))) { c.res = c.text("Your role doesn't have access to this page.", 403); return; }
  c.set("biz", row); c.set("role", row.role);
  await next();
}
const shell = (c: C, active: string, title: string, children: any) =>
  c.html(<AppShell user={c.get("user")!} biz={c.get("biz")} role={c.get("role")} active={active} title={title} ok={c.req.query("ok")} err={c.req.query("err")}>{children}</AppShell>);
const back = (c: C, path: string, msg: string, key = "ok") => c.redirect(`/app/${c.get("biz").slug}${path}?${key}=${encodeURIComponent(msg)}`);

type BookingRow = { id: number; starts_at: string; ends_at: string; status: string; notes: string; service: string; client: string; email: string; phone: string };
const BOOKING_SQL = "SELECT b.id, b.starts_at, b.ends_at, b.status, b.notes, s.name AS service, c.name AS client, c.email, c.phone FROM bookings b JOIN services s ON s.id = b.service_id JOIN clients c ON c.id = b.client_id WHERE b.business_id = ?";
const STATUS: Record<string, [string, string]> = { confirmed: ["Confirmed", "ok"], completed: ["Completed", ""], cancelled: ["Cancelled", "bad"], no_show: ["Didn't come", "warn"] };

const BookingTable = (p: { rows: BookingRow[]; biz: Business; actions?: boolean; empty: string }) =>
  p.rows.length === 0 ? <div class="empty">{p.empty}</div> : (
    <div class="tw"><table>
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>Status</th>{p.actions ? <th></th> : null}</tr></thead>
      <tbody>{p.rows.map((b) => { const at = new Date(b.starts_at); const [label, cls] = STATUS[b.status] ?? [b.status, ""]; return (
        <tr>
          <td style="white-space:nowrap"><b>{fmtTime(at, p.biz.timezone)}</b><br /><span class="faint">{fmtDay(at, p.biz.timezone)}</span></td>
          <td><b>{b.client}</b><br /><span class="faint">{b.email}{b.phone ? ` · ${b.phone}` : ""}</span>{b.notes ? <div class="hint">“{b.notes}”</div> : null}</td>
          <td>{b.service}</td>
          <td><span class={`pill ${cls}`}>{label}</span></td>
          {p.actions ? <td style="white-space:nowrap">{b.status === "confirmed" ? (
            <form method="post" action={`/app/${p.biz.slug}/bookings/${b.id}/status`} class="inline">
              <button class="btn sm" name="status" value="completed">Done</button>{" "}
              <button class="btn sm" name="status" value="no_show">Didn't come</button>{" "}
              <button class="btn sm danger" name="status" value="cancelled">Cancel</button>
            </form>) : null}</td> : null}
        </tr>); })}</tbody>
    </table></div>);

/* ---------- today ---------- */
dash.get("/:slug", async (c) => {
  const biz = c.get("biz"), db = c.env.DB, ind = industryOf(biz.industry);
  const today = localDate(new Date(), biz.timezone).date;
  const dayStart = iso(localToUtc(today, 0, biz.timezone)), dayEnd = iso(localToUtc(addDays(today, 1), 0, biz.timezone)), weekEnd = iso(localToUtc(addDays(today, 7), 0, biz.timezone));
  const [todays, upcoming, counts, pays, priced] = await Promise.all([
    db.prepare(`${BOOKING_SQL} AND b.starts_at >= ? AND b.starts_at < ? AND b.status != 'cancelled' ORDER BY b.starts_at`).bind(biz.id, dayStart, dayEnd).all<BookingRow>(),
    db.prepare(`${BOOKING_SQL} AND b.starts_at >= ? AND b.starts_at < ? AND b.status = 'confirmed' ORDER BY b.starts_at LIMIT 20`).bind(biz.id, dayEnd, weekEnd).all<BookingRow>(),
    db.prepare("SELECT (SELECT COUNT(*) FROM clients WHERE business_id = ?1) AS clients, (SELECT COUNT(*) FROM bookings WHERE business_id = ?1 AND status = 'confirmed' AND starts_at >= ?2) AS ahead, (SELECT COUNT(*) FROM bookings WHERE business_id = ?1 AND created_at >= ?3) AS month").bind(biz.id, dayStart, iso(new Date(Date.now() - 30 * 86400_000))).first<{ clients: number; ahead: number; month: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM payment_methods WHERE business_id = ?").bind(biz.id).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM services WHERE business_id = ? AND active = 1 AND price != ''").bind(biz.id).first<{ n: number }>(),
  ]);
  const todo: [string, string, string][] = [];
  if (canManage(c.get("role"))) {
    if (!priced?.n) todo.push([`Add prices to your ${ind.items.toLowerCase()}`, "Customers book more when they can see a price.", "services"]);
    if (!pays?.n) todo.push(["Say how you'd like to be paid", "M-Pesa, bank transfer, cash: customers see it when they book.", "payments"]);
    if (!biz.tagline) todo.push(["Finish your booking page", "Add a tagline, your address and a WhatsApp number.", "page"]);
  }
  return shell(c, "today", "Today", <>
    <div class="head"><div><h1>Today</h1><p>{fmtDay(new Date(), biz.timezone)} · {todays.results.length} booked today</p></div>
      <button class="btn" data-copy={`${c.env.APP_URL}/${biz.slug}`}>Copy booking link</button></div>
    <div class="tiles">
      <div class="tile"><span>Today</span><b>{todays.results.length}</b></div>
      <div class="tile"><span>Upcoming</span><b>{counts?.ahead ?? 0}</b></div>
      <div class="tile"><span>Booked in the last 30 days</span><b>{counts?.month ?? 0}</b></div>
      <div class="tile"><span>{ind.clients}</span><b>{counts?.clients ?? 0}</b></div>
    </div>
    {todo.length ? <div class="card"><h2>Finish setting up</h2>{todo.map(([t, d, to]) => <a class="svc" style="margin-top:8px" href={`/app/${biz.slug}/${to}`}><span class="t"><b>{t}</b><small>{d}</small></span><span class="p">Open</span></a>)}</div> : null}
    <div class="card"><h2>Today's bookings</h2><BookingTable rows={todays.results} biz={biz} actions empty="Nothing booked today. Share your booking link to get started." /></div>
    <div class="card"><h2>Next 7 days</h2><BookingTable rows={upcoming.results} biz={biz} actions empty="Nothing booked in the next week yet." /></div>
    <script src="/app.js" defer></script>
  </>);
});

/* ---------- bookings ---------- */
dash.get("/:slug/bookings", async (c) => {
  const biz = c.get("biz"), past = c.req.query("show") === "past", now = iso(new Date());
  const rows = await c.env.DB.prepare(`${BOOKING_SQL} AND b.starts_at ${past ? "<" : ">="} ? ORDER BY b.starts_at ${past ? "DESC" : "ASC"} LIMIT 100`).bind(biz.id, now).all<BookingRow>();
  return shell(c, "bookings", "Bookings", <>
    <div class="head"><div><h1>Bookings</h1><p>{past ? "Past bookings, newest first." : "Everything coming up."}</p></div>
      <div><a class="btn sm" href={`/app/${biz.slug}/bookings`} aria-current={past ? undefined : "page"}>Upcoming</a>{" "}<a class="btn sm" href={`/app/${biz.slug}/bookings?show=past`} aria-current={past ? "page" : undefined}>Past</a></div></div>
    <div class="card"><BookingTable rows={rows.results} biz={biz} actions empty={past ? "No past bookings yet." : "No upcoming bookings yet."} /></div>
  </>);
});
dash.post("/:slug/bookings/:id/status", async (c) => {
  const status = str((await c.req.parseBody()).status, 20);
  if (!["completed", "no_show", "cancelled"].includes(status)) return back(c, "/bookings", "Unknown status.", "err");
  await c.env.DB.prepare("UPDATE bookings SET status = ? WHERE id = ? AND business_id = ? AND status = 'confirmed'").bind(status, parseInt(c.req.param("id"), 10) || 0, c.get("biz").id).run();
  return back(c, "/bookings", `Booking marked as ${STATUS[status][0].toLowerCase()}.`);
});

/* ---------- clients ---------- */
dash.get("/:slug/clients", async (c) => {
  const biz = c.get("biz"), ind = industryOf(biz.industry);
  const rows = await c.env.DB.prepare(
    `SELECT c.name, c.email, c.phone, c.marketing_ok, COUNT(b.id) AS visits, MAX(b.starts_at) AS last FROM clients c LEFT JOIN bookings b ON b.client_id = c.id AND b.status != 'cancelled'
     WHERE c.business_id = ? GROUP BY c.id ORDER BY last DESC LIMIT 200`).bind(biz.id).all<{ name: string; email: string; phone: string; marketing_ok: number; visits: number; last: string | null }>();
  return shell(c, "clients", ind.clients, <>
    <div class="head"><div><h1>{ind.clients}</h1><p>Everyone who has booked with you. "Follow-ups OK" means they agreed to receive your follow-up emails.</p></div></div>
    <div class="card">{rows.results.length === 0 ? <div class="empty">No {ind.clients.toLowerCase()} yet. They appear here after their first booking.</div> :
      <div class="tw"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Bookings</th><th>Last booking</th><th>Follow-ups OK</th></tr></thead>
        <tbody>{rows.results.map((r) => <tr><td><b>{r.name}</b></td><td>{r.email}</td><td>{r.phone || "—"}</td><td>{r.visits}</td><td>{r.last ? fmtDay(new Date(r.last), biz.timezone) : "—"}</td><td>{r.marketing_ok ? <span class="pill ok">Yes</span> : <span class="faint">No</span>}</td></tr>)}</tbody></table></div>}</div>
  </>);
});

/* ---------- services ---------- */
dash.get("/:slug/services", async (c) => {
  const biz = c.get("biz"), ind = industryOf(biz.industry), base = `/app/${biz.slug}/services`;
  const rows = await c.env.DB.prepare("SELECT * FROM services WHERE business_id = ? ORDER BY sort, id").bind(biz.id).all<Service>();
  const Fields = (p: { s?: Service }) => (<div class="row">
    <div><label>Name</label><input type="text" name="name" required maxlength={80} value={p.s?.name} /></div>
    <div><label>Group (optional)</label><input type="text" name="group_name" maxlength={40} value={p.s?.group_name} /></div>
    <div><label>Minutes</label><input type="number" name="duration_min" min={5} max={600} step={5} required value={String(p.s?.duration_min ?? 60)} /></div>
    <div><label>Price</label><input type="text" name="price" maxlength={30} placeholder={`e.g. ${biz.currency} 3,500`} value={p.s?.price} /></div>
  </div>);
  return shell(c, "services", ind.items, <>
    <div class="head"><div><h1>{ind.items}</h1><p>What people can book, how long it takes and what it costs. Prices are shown as you type them.</p></div></div>
    {rows.results.map((s) => (
      <form method="post" action={`${base}/${s.id}`} class="card"><Fields s={s} />
        <div class="field" style="margin-top:12px"><label>Short description (optional)</label><input type="text" name="description" maxlength={160} value={s.description} /></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="check" style="margin:0 auto 0 0"><input type="checkbox" name="active" value="1" checked={!!s.active} />Shown on your booking page</label>
          <button class="btn sm danger" name="_action" value="delete">Remove</button><button class="btn sm pri" name="_action" value="save">Save</button></div>
      </form>))}
    <form method="post" action={base} class="card"><h2>Add {ind.item === "appointment type" ? "an" : "a"} {ind.item}</h2><Fields /><button class="btn pri" style="margin-top:12px">Add</button></form>
  </>);
});
const serviceInput = (f: Record<string, unknown>) => ({ name: str(f.name, 80), group: str(f.group_name, 40), min: int(f.duration_min, 5, 600, 60), price: str(f.price, 30), desc: str(f.description, 160) });
dash.post("/:slug/services", async (c) => {
  const s = serviceInput(await c.req.parseBody()), biz = c.get("biz");
  if (!s.name) return back(c, "/services", "Please enter a name.", "err");
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM services WHERE business_id = ?").bind(biz.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= 60) return back(c, "/services", "You've reached the limit of 60.", "err");
  await c.env.DB.prepare("INSERT INTO services (business_id, name, group_name, duration_min, price, sort) VALUES (?, ?, ?, ?, ?, ?)").bind(biz.id, s.name, s.group, s.min, s.price, n?.n ?? 0).run();
  return back(c, "/services", "Added.");
});
dash.post("/:slug/services/:id", async (c) => {
  const f = await c.req.parseBody(), s = serviceInput(f), biz = c.get("biz"), id = parseInt(c.req.param("id"), 10) || 0;
  if (str(f._action) === "delete") {
    // Services with bookings are hidden rather than deleted, so history stays intact.
    const used = await c.env.DB.prepare("SELECT 1 FROM bookings WHERE service_id = ? LIMIT 1").bind(id).first();
    await c.env.DB.prepare(used ? "UPDATE services SET active = 0 WHERE id = ? AND business_id = ?" : "DELETE FROM services WHERE id = ? AND business_id = ?").bind(id, biz.id).run();
    return back(c, "/services", used ? "Hidden from your booking page (it has past bookings, so it was kept)." : "Removed.");
  }
  if (!s.name) return back(c, "/services", "Please enter a name.", "err");
  await c.env.DB.prepare("UPDATE services SET name = ?, group_name = ?, duration_min = ?, price = ?, description = ?, active = ? WHERE id = ? AND business_id = ?").bind(s.name, s.group, s.min, s.price, s.desc, f.active ? 1 : 0, id, biz.id).run();
  return back(c, "/services", "Saved.");
});

/* ---------- opening hours ---------- */
dash.get("/:slug/hours", async (c) => {
  const biz = c.get("biz");
  const rows = await c.env.DB.prepare("SELECT weekday, open_min, close_min FROM hours WHERE business_id = ?").bind(biz.id).all<{ weekday: number; open_min: number; close_min: number }>();
  const by = new Map(rows.results.map((h) => [h.weekday, h]));
  return shell(c, "hours", "Opening hours", <>
    <div class="head"><div><h1>Opening hours</h1><p>Customers can only book inside these hours. Times are in {biz.timezone}.</p></div></div>
    <form method="post" action={`/app/${biz.slug}/hours`} class="card">
      <div class="tw"><table><thead><tr><th>Day</th><th>Open</th><th>From</th><th>Until</th></tr></thead><tbody>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => { const h = by.get(d); return (<tr>
          <td><b>{WEEKDAYS[d]}</b></td>
          <td><input type="checkbox" name={`open${d}`} value="1" checked={!!h} aria-label={`Open on ${WEEKDAYS[d]}`} /></td>
          <td><input type="time" name={`from${d}`} value={minToLabel(h?.open_min ?? 540)} aria-label={`${WEEKDAYS[d]} opening time`} /></td>
          <td><input type="time" name={`to${d}`} value={minToLabel(h?.close_min ?? 1080)} aria-label={`${WEEKDAYS[d]} closing time`} /></td></tr>); })}
      </tbody></table></div>
      <div class="row" style="margin-top:16px">
        <div class="field"><label for="slot">Offer a start time every</label><select id="slot" name="slot_minutes">{[15, 30, 60].map((m) => <option value={m} selected={biz.slot_minutes === m}>{m} minutes</option>)}</select></div>
        <div class="field"><label for="notice">Shortest notice for a booking</label><select id="notice" name="notice_hours">{[0, 1, 2, 4, 12, 24, 48].map((h) => <option value={h} selected={biz.notice_hours === h}>{h === 0 ? "No minimum" : `${h} hour${h > 1 ? "s" : ""}`}</option>)}</select></div>
      </div>
      <button class="btn pri">Save hours</button>
    </form>
  </>);
});
dash.post("/:slug/hours", async (c) => {
  const f = await c.req.parseBody(), biz = c.get("biz"), db = c.env.DB;
  const stmts = [db.prepare("DELETE FROM hours WHERE business_id = ?").bind(biz.id)];
  for (let d = 0; d < 7; d++) {
    if (!f[`open${d}`]) continue;
    const from = labelToMin(str(f[`from${d}`])), to = labelToMin(str(f[`to${d}`]));
    if (!(from >= 0 && to <= 1440 && from < to)) return back(c, "/hours", `Check the times for ${WEEKDAYS[d]}: closing must be after opening.`, "err");
    stmts.push(db.prepare("INSERT INTO hours (business_id, weekday, open_min, close_min) VALUES (?, ?, ?, ?)").bind(biz.id, d, from, to));
  }
  const slot = [15, 30, 60].includes(int(f.slot_minutes, 15, 60, 30)) ? int(f.slot_minutes, 15, 60, 30) : 30;
  stmts.push(db.prepare("UPDATE businesses SET slot_minutes = ?, notice_hours = ? WHERE id = ?").bind(slot, int(f.notice_hours, 0, 48, 2), biz.id));
  await db.batch(stmts);
  return back(c, "/hours", "Opening hours saved.");
});

/* ---------- payment methods (display only) ---------- */
dash.get("/:slug/payments", async (c) => {
  const biz = c.get("biz"), base = `/app/${biz.slug}/payments`, rows = await payMethods(c.env, biz.id);
  return shell(c, "payments", "Payment methods", <>
    <div class="head"><div><h1>Payment methods</h1><p>Tell customers how to pay you. This is shown on your booking page and in their confirmation email. Wanlly Book never takes or holds any money: customers pay you directly.</p></div></div>
    {rows.map((m) => (<div class="card" style="display:flex;gap:12px;align-items:flex-start">
      <div style="flex:1;min-width:0"><b>{m.label}</b>{m.details ? <div class="mono" style="overflow-wrap:anywhere">{m.details}</div> : null}{m.instructions ? <div class="hint">{m.instructions}</div> : null}</div>
      <form method="post" action={`${base}/${m.id}/delete`}><button class="btn sm danger">Remove</button></form></div>))}
    {rows.length === 0 ? <div class="card empty">No payment methods yet. Add the first one below.</div> : null}
    <form method="post" action={base} class="card"><h2>Add a payment method</h2>
      <div class="row">
        <div class="field"><label for="kind">Type</label><select id="kind" name="kind">{Object.entries(PAYMENT_KINDS).map(([k, v]) => <option value={k}>{v.label}</option>)}</select></div>
        <div class="field"><label for="label">Name shown to customers (optional)</label><input type="text" id="label" name="label" maxlength={40} placeholder="e.g. M-Pesa Till" /></div>
      </div>
      <div class="field"><label for="details">Details</label><input type="text" id="details" name="details" maxlength={160} placeholder="e.g. Till 123456 · Luna Lash Studio" />
        <div class="hint">Only share what customers need to pay you, such as a till number or account number. Never add PINs or passwords.</div></div>
      <div class="field"><label for="instructions">Instructions (optional)</label><input type="text" id="instructions" name="instructions" maxlength={160} placeholder="e.g. Pay a KES 500 deposit to confirm, the rest on the day" /></div>
      <button class="btn pri">Add payment method</button>
    </form>
  </>);
});
dash.post("/:slug/payments", async (c) => {
  const f = await c.req.parseBody(), biz = c.get("biz"), kind = PAYMENT_KINDS[str(f.kind)] ? str(f.kind) : "other";
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM payment_methods WHERE business_id = ?").bind(biz.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= 8) return back(c, "/payments", "You can list up to 8 payment methods.", "err");
  await c.env.DB.prepare("INSERT INTO payment_methods (business_id, kind, label, details, instructions, sort) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(biz.id, kind, str(f.label, 40) || PAYMENT_KINDS[kind].label, str(f.details, 160), str(f.instructions, 160), n?.n ?? 0).run();
  return back(c, "/payments", "Payment method added.");
});
dash.post("/:slug/payments/:id/delete", async (c) => {
  await c.env.DB.prepare("DELETE FROM payment_methods WHERE id = ? AND business_id = ?").bind(parseInt(c.req.param("id"), 10) || 0, c.get("biz").id).run();
  return back(c, "/payments", "Removed.");
});

/* ---------- automatic emails ---------- */
const EMAIL_KINDS: [string, string, string, string][] = [
  ["confirmation", "Booking confirmation", "Sent straight away when someone books.", ""],
  ["reminder", "Reminder", "Sent before the booking so people turn up.", "Hours before"],
  ["followup", "Follow-up", "Sent after the booking, to bring people back. Only goes to people who agreed to follow-ups, and every one has a link to stop them.", "Days after"],
];
dash.get("/:slug/emails", async (c) => {
  const biz = c.get("biz");
  const rows = await c.env.DB.prepare("SELECT kind, enabled, offset_hours, subject, body FROM email_settings WHERE business_id = ?").bind(biz.id).all<{ kind: string; enabled: number; offset_hours: number; subject: string; body: string }>();
  const by = new Map(rows.results.map((r) => [r.kind, r]));
  return shell(c, "emails", "Emails", <>
    <div class="head"><div><h1>Emails</h1><p>These go out by themselves. Use these placeholders and they're filled in for each person: <span class="mono">{"{name} {service} {date} {time} {business} {address} {payment} {manage} {link}"}</span></p></div></div>
    {EMAIL_KINDS.map(([kind, title, desc, offLabel]) => { const e = by.get(kind); if (!e) return null; return (
      <form method="post" action={`/app/${biz.slug}/emails/${kind}`} class="card">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px">
          <div><h2>{title}</h2><p class="muted" style="font-size:13.5px;max-width:60ch">{desc}</p></div>
          <label class="check" style="margin:0"><input type="checkbox" name="enabled" value="1" checked={!!e.enabled} />Turned on</label></div>
        <div class="row">
          {offLabel ? <div class="field" style="max-width:160px"><label>{offLabel}</label><input type="number" name="offset" min={1} max={kind === "followup" ? 60 : 72} value={String(kind === "followup" ? Math.max(1, Math.round(e.offset_hours / 24)) : e.offset_hours)} /></div> : null}
          <div class="field"><label>Subject</label><input type="text" name="subject" required maxlength={120} value={e.subject} /></div>
        </div>
        <div class="field"><label>Message</label><textarea name="body" required maxlength={2000}>{e.body}</textarea></div>
        <button class="btn pri">Save</button>
      </form>); })}
  </>);
});
dash.post("/:slug/emails/:kind", async (c) => {
  const f = await c.req.parseBody(), kind = c.req.param("kind"), biz = c.get("biz");
  if (!EMAIL_KINDS.some(([k]) => k === kind)) return back(c, "/emails", "Unknown email.", "err");
  const subject = str(f.subject, 120), body = str(f.body, 2000);
  if (!subject || !body) return back(c, "/emails", "The subject and message can't be empty.", "err");
  const offset = kind === "confirmation" ? 0 : kind === "followup" ? int(f.offset, 1, 60, 7) * 24 : int(f.offset, 1, 72, 24);
  await c.env.DB.prepare("UPDATE email_settings SET enabled = ?, offset_hours = ?, subject = ?, body = ? WHERE business_id = ? AND kind = ?").bind(f.enabled ? 1 : 0, offset, subject, body, biz.id, kind).run();
  return back(c, "/emails", "Email saved.");
});

/* ---------- booking page settings ---------- */
dash.get("/:slug/page", (c) => {
  const biz = c.get("biz"), url = `${c.env.APP_URL}/${biz.slug}`;
  return shell(c, "page", "Booking page", <>
    <div class="head"><div><h1>Booking page</h1><p>What customers see when they open your link.</p></div><a class="btn" href={`/${biz.slug}`} target="_blank" rel="noopener">Open my page</a></div>
    <div class="card"><h2>Your link</h2><div class="linkbox"><span style="flex:1">{url}</span><button class="btn sm" data-copy={url}>Copy</button></div>
      <p class="hint">Put it in your Instagram bio, WhatsApp status and anywhere people find you.</p></div>
    <form method="post" action={`/app/${biz.slug}/page`} class="card"><h2>Details</h2>
      <div class="field"><label for="name">Business name</label><input type="text" id="name" name="name" required maxlength={80} value={biz.name} /></div>
      <div class="field"><label for="tagline">Tagline</label><input type="text" id="tagline" name="tagline" maxlength={120} value={biz.tagline} placeholder="One line about what you do" /></div>
      <div class="field"><label for="about">About (optional)</label><textarea id="about" name="about" maxlength={600} style="min-height:80px">{biz.about}</textarea></div>
      <div class="row">
        <div class="field"><label for="address">Address</label><input type="text" id="address" name="address" maxlength={160} value={biz.address} /></div>
        <div class="field"><label for="phone">Phone</label><input type="tel" id="phone" name="phone" maxlength={30} value={biz.phone} /></div>
      </div>
      <div class="row">
        <div class="field"><label for="whatsapp">WhatsApp number</label><input type="tel" id="whatsapp" name="whatsapp" maxlength={20} value={biz.whatsapp} placeholder="2547XXXXXXXX" /><div class="hint">With country code, digits only. Adds a WhatsApp button to your page.</div></div>
        <div class="field"><label for="contact_email">Email for new booking alerts</label><input type="email" id="contact_email" name="contact_email" maxlength={254} value={biz.contact_email} /></div>
      </div>
      <div class="field"><label>Colour</label><div class="swatches">{Object.entries(BRANDS).map(([k, b]) => <label><input type="radio" name="brand" value={k} checked={biz.brand === k} /><i style={`background:${b.accent};border-color:${b.deep}`}></i>{b.label}</label>)}</div></div>
      <div class="row">
        <div class="field"><label for="currency">Currency</label><select id="currency" name="currency">{CURRENCIES.map((x) => <option selected={biz.currency === x}>{x}</option>)}</select></div>
        <div class="field"><label for="timezone">Time zone</label><select id="timezone" name="timezone">{TIMEZONES.map((x) => <option selected={biz.timezone === x}>{x}</option>)}</select></div>
      </div>
      <button class="btn pri">Save</button>
    </form><script src="/app.js" defer></script>
  </>);
});
dash.post("/:slug/page", async (c) => {
  const f = await c.req.parseBody(), biz = c.get("biz");
  const name = str(f.name, 80), email = normEmail(str(f.contact_email, 254));
  if (name.length < 2) return back(c, "/page", "Please enter your business name.", "err");
  if (email && !isEmail(email)) return back(c, "/page", "That alert email doesn't look right.", "err");
  await c.env.DB.prepare("UPDATE businesses SET name = ?, tagline = ?, about = ?, address = ?, phone = ?, whatsapp = ?, contact_email = ?, brand = ?, currency = ?, timezone = ? WHERE id = ?")
    .bind(name, str(f.tagline, 120), str(f.about, 600), str(f.address, 160), str(f.phone, 30), str(f.whatsapp, 20).replace(/\D/g, ""), email,
      BRANDS[str(f.brand)] ? str(f.brand) : biz.brand, CURRENCIES.includes(str(f.currency)) ? str(f.currency) : biz.currency, TIMEZONES.includes(str(f.timezone)) ? str(f.timezone) : biz.timezone, biz.id).run();
  return back(c, "/page", "Booking page saved.");
});

/* ---------- team and roles (owner only) ---------- */
dash.get("/:slug/team", async (c) => {
  const biz = c.get("biz"), base = `/app/${biz.slug}/team`;
  const rows = await c.env.DB.prepare("SELECT u.id, u.email, m.role FROM members m JOIN users u ON u.id = m.user_id WHERE m.business_id = ? ORDER BY m.role = 'owner' DESC, u.email").bind(biz.id).all<{ id: number; email: string; role: string }>();
  return shell(c, "team", "Team and roles", <>
    <div class="head"><div><h1>Team and roles</h1><p>Give people access with the role that fits. They sign in with their own email.</p></div></div>
    <div class="card"><div class="tw"><table><thead><tr><th>Person</th><th>Role</th><th></th></tr></thead><tbody>
      {rows.results.map((m) => <tr><td>{m.email}</td><td><span class="pill">{ROLES[m.role] ?? m.role}</span></td>
        <td>{m.role !== "owner" ? <form method="post" action={`${base}/${m.id}/remove`} class="inline"><button class="btn sm danger">Remove</button></form> : null}</td></tr>)}
    </tbody></table></div></div>
    <form method="post" action={base} class="card"><h2>Add someone</h2>
      <div class="row">
        <div class="field"><label for="email">Their email</label><input type="email" id="email" name="email" required maxlength={254} /></div>
        <div class="field"><label for="role">Role</label><select id="role" name="role"><option value="manager">Manager</option><option value="staff" selected>Staff</option><option value="desk">Front desk</option></select></div>
      </div>
      <button class="btn pri">Add to team</button>
    </form>
    <div class="card"><h2>What each role can do</h2><div class="tw"><table><thead><tr><th></th><th>Owner</th><th>Manager</th><th>Staff</th><th>Front desk</th></tr></thead><tbody>
      {[["See and update bookings", 1, 1, 1, 1], ["See customers", 1, 1, 1, 1], ["Change services, hours and payment methods", 1, 1, 0, 0], ["Edit emails and the booking page", 1, 1, 0, 0], ["Add or remove team members", 1, 0, 0, 0]].map(([l, ...v]) =>
        <tr><td>{l}</td>{v.map((x) => <td>{x ? <span class="pill ok">Yes</span> : <span class="faint">No</span>}</td>)}</tr>)}
    </tbody></table></div></div>
  </>);
});
dash.post("/:slug/team", async (c) => {
  const f = await c.req.parseBody(), biz = c.get("biz"), email = normEmail(str(f.email, 254)), role = ["manager", "staff", "desk"].includes(str(f.role)) ? str(f.role) : "staff";
  if (!isEmail(email)) return back(c, "/team", "Please enter a valid email.", "err");
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE business_id = ?").bind(biz.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= 15) return back(c, "/team", "A team can have up to 15 people.", "err");
  await c.env.DB.prepare("INSERT OR IGNORE INTO users (email) VALUES (?)").bind(email).run();
  const u = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<User>();
  const added = await c.env.DB.prepare("INSERT OR IGNORE INTO members (business_id, user_id, role) VALUES (?, ?, ?)").bind(biz.id, u!.id, role).run();
  if (!added.meta.changes) return back(c, "/team", "That person is already on the team.", "err");
  c.executionCtx.waitUntil(sendMail(c.env, { to: email, subject: `You've been added to ${biz.name} on Wanlly Book`, text: `Hi,\n\n${c.get("user")!.email} added you to ${biz.name} as ${ROLES[role]}.\n\nSign in with this email address here:\n${c.env.APP_URL}/login` }));
  return back(c, "/team", `${email} added as ${ROLES[role]}.`);
});
dash.post("/:slug/team/:id/remove", async (c) => {
  await c.env.DB.prepare("DELETE FROM members WHERE business_id = ? AND user_id = ? AND role != 'owner'").bind(c.get("biz").id, parseInt(c.req.param("id"), 10) || 0).run();
  return back(c, "/team", "Removed from the team.");
});

export { sendBookingEmail };
