/** Wanlly Book: free booking pages for any business. Cloudflare Worker entry point. */
import { Hono } from "hono";
import { dash } from "./app";
import { createLoginLink, currentUser, endSession, isEmail, normEmail, randomToken, redeemLoginToken, startSession } from "./auth";
import { payMethods, rangeSlots, runEmailJobs, sendBookingEmail } from "./booking";
import { sendMail } from "./mail";
import { industryOf } from "./templates";
import { fmtDayLong, fmtTime, isDate, iso, localDate, addDays, weekdayOf } from "./time";
import type { Business, Env, PayMethod, Service, Vars } from "./types";
import { brandStyle, Flash, Logo, Page, PublicFooter } from "./ui";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const DAYS_AHEAD = 21;

/* ---------- security for every request ---------- */
app.use("*", async (c, next) => {
  // Forms must be posted from our own pages. Together with the SameSite cookie this blocks cross-site requests.
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    let originHost = "";
    try { originHost = new URL(c.req.header("origin") ?? "").host; } catch { /* missing or malformed */ }
    if (originHost !== new URL(c.req.url).host) return c.text("This request didn't come from Wanlly Book.", 403);
  }
  c.set("user", await currentUser(c as any));
  await next();
  c.header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (c.get("user")) c.header("Cache-Control", "no-store");
});

/* ---------- home ---------- */
app.get("/", (c) => c.html(
  <Page title="Wanlly Book · Free booking pages for any business">
    <div class="hero"><div class="wrap">
      <div class="pnav"><b>Wanlly Book</b>{c.get("user") ? <a class="bbtn ghost" href="/app">Open my dashboard</a> : <a class="bbtn ghost" href="/login">Sign in</a>}</div>
      <h1>Take bookings online. Free.</h1>
      <p>Get your own booking page in a minute. Customers pick a time, you both get an email, and reminders and follow-ups send themselves.</p>
      <div class="acts"><a class="bbtn" href="/login">Create my booking page</a></div>
    </div></div>
    <div class="sec"><div class="wrap"><div class="features">
      {[["One link for all your bookings", "Share it on Instagram, WhatsApp or anywhere. It works in any browser, with nothing to download."],
        ["Emails that send themselves", "Confirmations, reminders before the booking and follow-ups after, in your own words."],
        ["Get paid your way", "Show customers how to pay you: M-Pesa, bank transfer, cash or anything else. We never touch your money."],
        ["Made for your kind of business", "Salons, clinics, estate agents, studios, tutors and more, each with wording that fits."],
        ["Your whole team", "Add staff with the right role, so everyone sees what they need."],
        ["Free to use", "No subscription and no commission on your bookings."]].map(([t, d]) => <div class="card" style="margin:0"><h3>{t}</h3><p class="muted" style="margin-top:4px;font-size:14px">{d}</p></div>)}
    </div></div></div>
    <footer class="pfoot"><div class="wrap">Wanlly Book is part of Wanlly.</div></footer>
  </Page>));

/* ---------- sign in by email link ---------- */
const LoginPage = (p: { err?: string; sent?: string; devLink?: string | null }) => (
  <Page title="Sign in · Wanlly Book"><div class="narrow"><Logo />
    {p.sent ? (<>
      <h1 style="margin:24px 0 8px">Check your email</h1>
      <p class="muted">We sent a sign-in link to <b>{p.sent}</b>. It works once and expires in 15 minutes.</p>
      {p.devLink ? <div class="card" style="margin-top:16px"><b>Development mode</b><p class="hint">Email isn't set up, so here is the link:</p><a href={p.devLink} id="devlink" style="overflow-wrap:anywhere">{p.devLink}</a></div> : null}
      <p style="margin-top:16px"><a href="/login">Use a different email</a></p>
    </>) : (<>
      <h1 style="margin:24px 0 8px">Sign in or create your page</h1>
      <p class="muted" style="margin-bottom:18px">Enter your email and we'll send you a link. No password to remember.</p>
      <Flash err={p.err} />
      <form method="post" action="/login" class="card">
        <div class="field"><label for="email">Email</label><input type="email" id="email" name="email" required autocomplete="email" autofocus /></div>
        <button class="btn pri block">Email me a sign-in link</button>
      </form>
    </>)}
  </div></Page>
);
app.get("/login", (c) => (c.get("user") ? c.redirect("/app") : c.html(<LoginPage />)));
app.post("/login", async (c) => {
  const email = normEmail(str((await c.req.parseBody()).email, 254));
  if (!isEmail(email)) return c.html(<LoginPage err="Please enter a valid email address." />, 400);
  const link = await createLoginLink(c.env, email);
  if (!link) return c.html(<LoginPage err="Too many links requested. Please wait 15 minutes and try again." />, 429);
  c.executionCtx.waitUntil(sendMail(c.env, { to: email, subject: "Your Wanlly Book sign-in link", text: `Hi,\n\nUse this link to sign in to Wanlly Book. It works once and expires in 15 minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.` }));
  const showLink = c.env.DEV_SHOW_LINKS === "1" && !c.env.RESEND_API_KEY;
  return c.html(<LoginPage sent={email} devLink={showLink ? link : null} />);
});
// The emailed link opens a page with a button. The sign-in itself is a POST, so email scanners
// that open links automatically can't use up the token.
app.get("/auth/verify", (c) => c.html(
  <Page title="Sign in · Wanlly Book"><div class="narrow"><Logo />
    <h1 style="margin:24px 0 14px">Finish signing in</h1>
    <form method="post" action="/auth/verify"><input type="hidden" name="token" value={c.req.query("token") ?? ""} /><button class="btn pri block" id="finish">Sign in to Wanlly Book</button></form>
  </div></Page>));
app.post("/auth/verify", async (c) => {
  const user = await redeemLoginToken(c.env, str((await c.req.parseBody()).token, 100));
  if (!user) return c.html(<LoginPage err="That link has expired or was already used. Enter your email for a new one." />, 400);
  await startSession(c as any, user.id);
  return c.redirect("/app");
});
app.post("/logout", async (c) => { await endSession(c as any); return c.redirect("/"); });

app.route("/app", dash);

// Local development only: run the reminder and follow-up job on demand.
app.get("/__jobs", async (c) => (c.env.DEV_SHOW_LINKS === "1" ? c.json(await runEmailJobs(c.env)) : c.notFound()));

/* ---------- public booking pages: /:slug ---------- */
const findBiz = (env: Env, slug: string) => env.DB.prepare("SELECT * FROM businesses WHERE slug = ?").bind(slug.toLowerCase()).first<Business>();
const activeServices = (env: Env, bizId: number) => env.DB.prepare("SELECT * FROM services WHERE business_id = ? AND active = 1 ORDER BY sort, id").bind(bizId).all<Service>().then((r) => r.results);

const PayList = (p: { methods: PayMethod[] }) => (
  <div class="pays">{p.methods.map((m) => <div class="pay"><b>{m.label}</b>{m.details ? <div class="d">{m.details}</div> : null}{m.instructions ? <small>{m.instructions}</small> : null}</div>)}</div>
);
const PublicTop = (p: { biz: Business; cta?: string }) => (
  <div class="pnav"><a href={`/${p.biz.slug}`} style="text-decoration:none"><b>{p.biz.name}</b></a>{p.cta ? <a class="bbtn" href={`/${p.biz.slug}/book`} style="padding:9px 16px;font-size:14px">{p.cta}</a> : null}</div>
);

app.get("/:slug", async (c) => {
  const biz = await findBiz(c.env, c.req.param("slug"));
  if (!biz) return c.notFound();
  const [services, methods] = await Promise.all([activeServices(c.env, biz.id), payMethods(c.env, biz.id)]);
  const ind = industryOf(biz.industry);
  const groups = new Map<string, Service[]>();
  for (const s of services) groups.set(s.group_name, [...(groups.get(s.group_name) ?? []), s]);
  return c.html(
    <Page title={`${biz.name} · Book online`} style={brandStyle(biz)}>
      <div class="hero"><div class="wrap">
        <PublicTop biz={biz} cta={ind.cta} />
        <h1>{biz.tagline || `Book with ${biz.name}`}</h1>
        {biz.about ? <p>{biz.about}</p> : <p>Pick a time that suits you. You'll get a confirmation by email straight away.</p>}
        <div class="acts"><a class="bbtn" href={`/${biz.slug}/book`}>{ind.cta}</a>
          {biz.whatsapp ? <a class="bbtn wa" href={`https://wa.me/${biz.whatsapp}`} target="_blank" rel="noopener">Chat on WhatsApp</a> : null}</div>
      </div></div>
      <div class="sec"><div class="wrap"><h2>{ind.items}</h2>
        {services.length === 0 ? <p class="muted">Nothing to book just yet. Please check back soon.</p> : [...groups].map(([g, list]) => (<>
          {g ? <div class="gname">{g}</div> : null}
          <div class="svcs">{list.map((s) => <a class="svc" href={`/${biz.slug}/book?service=${s.id}`}><span class="t"><b>{s.name}</b><small>{s.duration_min} min{s.description ? ` · ${s.description}` : ""}</small></span>{s.price ? <span class="p">{s.price}</span> : null}</a>)}</div>
        </>))}
      </div></div>
      {methods.length ? <div class="sec"><div class="wrap"><h2>How to pay</h2><PayList methods={methods} /><p class="hint" style="margin-top:10px">You pay {biz.name} directly.</p></div></div> : null}
      <PublicFooter biz={biz} />
    </Page>);
});

/* booking form: pick a service, a day and a time, then enter details */
type FormState = { err?: string; name?: string; email?: string; phone?: string; notes?: string };
async function bookingForm(c: any, biz: Business, st: FormState = {}, status: 200 | 400 | 409 = 200) {
  const services = await activeServices(c.env, biz.id), ind = industryOf(biz.industry);
  const service = services.find((s) => String(s.id) === c.req.query("service")) ?? null;
  if (!service) return c.html(
    <Page title={`Book · ${biz.name}`} style={brandStyle(biz)}>
      <div class="hero" style="padding:20px 0"><div class="wrap"><PublicTop biz={biz} /></div></div>
      <div class="wrap" style="padding:28px 20px 56px"><h1 style="margin-bottom:14px">What would you like to book?</h1>
        {services.length === 0 ? <p class="muted">Nothing to book just yet.</p> : <div class="svcs">{services.map((s) => <a class="svc" href={`/${biz.slug}/book?service=${s.id}`}><span class="t"><b>{s.name}</b><small>{s.duration_min} min</small></span>{s.price ? <span class="p">{s.price}</span> : null}</a>)}</div>}
      </div><PublicFooter biz={biz} /></Page>);

  const today = localDate(new Date(), biz.timezone).date;
  const all = await rangeSlots(c.env, biz, service, today, DAYS_AHEAD);
  const asked = c.req.query("date") ?? "";
  const firstFree = [...all].find(([, s]) => s && s.length)?.[0];
  const date = isDate(asked) && all.has(asked) ? asked : firstFree ?? today;
  const slots = all.get(date) ?? null;
  const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(date + "T12:00:00Z"));
  const base = `/${biz.slug}/book?service=${service.id}`;
  return c.html(
    <Page title={`Book ${service.name} · ${biz.name}`} style={brandStyle(biz)}>
      <div class="hero" style="padding:20px 0"><div class="wrap"><PublicTop biz={biz} /></div></div>
      <div class="wrap"><div class="book">
        <form method="post" action={`/${biz.slug}/book`}>
          <input type="hidden" name="service" value={service.id} /><input type="hidden" name="date" value={date} />
          <h1 style="margin-bottom:4px">Pick a time</h1>
          <p class="muted" style="margin-bottom:16px">{service.name} · {service.duration_min} min · <a href={`/${biz.slug}/book`}>change</a></p>
          <Flash err={st.err} />
          <div class="days" role="list">{[...all].map(([d, s]) => { const dt = new Date(d + "T12:00:00Z"); return (
            <a role="listitem" class={`day${!s || !s.length ? " closed" : ""}`} href={`${base}&date=${d}`} aria-current={d === date ? "date" : undefined}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekdayOf(d)]}<b>{dt.getUTCDate()}</b>{!s ? "Closed" : s.length ? `${s.length} free` : "Full"}</a>); })}</div>
          <div class="card" style="margin-top:14px"><h2>{dayLabel}</h2>
            {!slots ? <p class="muted">Closed on this day. Please pick another.</p> : slots.length === 0 ? <p class="muted">No times left on this day. Please pick another.</p> :
              <div class="slots" role="radiogroup" aria-label="Start time">{slots.map((s) => <label><input type="radio" name="starts_at" value={s.startsAt} required /><span>{s.label}</span></label>)}</div>}
            <p class="hint">Times are shown in {biz.timezone.replace("_", " ")} time.</p>
          </div>
          <div class="card"><h2>Your details</h2>
            <div class="row">
              <div class="field"><label for="name">Name</label><input type="text" id="name" name="name" required maxlength={80} autocomplete="name" value={st.name} /></div>
              <div class="field"><label for="email">Email</label><input type="email" id="email" name="email" required maxlength={254} autocomplete="email" value={st.email} /></div>
            </div>
            <div class="field"><label for="phone">Phone or WhatsApp (optional)</label><input type="tel" id="phone" name="phone" maxlength={30} autocomplete="tel" value={st.phone} /></div>
            <div class="field"><label for="notes">Anything {biz.name} should know? (optional)</label><input type="text" id="notes" name="notes" maxlength={300} value={st.notes} /></div>
            <div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input type="text" id="website" name="website" tabindex={-1} autocomplete="off" /></div>
            <label class="check field"><input type="checkbox" name="marketing" value="1" />Send me follow-up emails from {biz.name} after my visit (optional)</label>
            <button class="bbtn" style="background:var(--deep);color:#fff;width:100%" disabled={!slots || slots.length === 0}>Confirm booking</button>
            <p class="hint" style="margin-top:10px">You'll get a confirmation and a reminder by email. Your details are shared only with {biz.name}.</p>
          </div>
        </form>
        <aside class="card summary"><h2>Your booking</h2>
          <div class="r"><span>{service.name}</span><b>{service.price || ""}</b></div>
          <div class="r"><span>Length</span><b>{service.duration_min} min</b></div>
          <div class="r"><span>Day</span><b>{dayLabel}</b></div>
          <p class="hint" style="margin-top:8px">{biz.name}{biz.address ? ` · ${biz.address}` : ""}</p>
        </aside>
      </div></div>
      <PublicFooter biz={biz} />
    </Page>, status);
}
app.get("/:slug/book", async (c) => { const biz = await findBiz(c.env, c.req.param("slug")); return biz ? bookingForm(c, biz) : c.notFound(); });

app.post("/:slug/book", async (c) => {
  const biz = await findBiz(c.env, c.req.param("slug"));
  if (!biz) return c.notFound();
  const f = await c.req.parseBody(), db = c.env.DB;
  const st = { name: str(f.name, 80), email: normEmail(str(f.email, 254)), phone: str(f.phone, 30), notes: str(f.notes, 300) };
  // Put the chosen service and date back into the URL so the form re-renders in the same place on errors.
  const again = (err: string, status: 400 | 409 = 400) => {
    const url = new URL(c.req.url); url.searchParams.set("service", str(f.service, 12)); url.searchParams.set("date", str(f.date, 10));
    return bookingForm({ env: c.env, req: { query: (k: string) => url.searchParams.get(k) ?? undefined }, html: c.html.bind(c) }, biz, { ...st, err }, status);
  };
  if (str(f.website)) return c.redirect(`/${biz.slug}`); // honeypot: bots fill hidden fields
  const service = await db.prepare("SELECT * FROM services WHERE id = ? AND business_id = ? AND active = 1").bind(parseInt(str(f.service), 10) || 0, biz.id).first<Service>();
  if (!service) return c.redirect(`/${biz.slug}/book`);
  if (st.name.length < 2) return again("Please enter your name.");
  if (!isEmail(st.email)) return again("Please enter a valid email address.");
  const startsAt = str(f.starts_at, 20);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(startsAt)) return again("Please choose a time.");

  // The chosen time must be one we would offer right now: inside opening hours, after the notice period, and free.
  const day = localDate(new Date(startsAt), biz.timezone).date;
  const today = localDate(new Date(), biz.timezone).date;
  if (day < today || day >= addDays(today, DAYS_AHEAD)) return again("That day isn't available. Please pick another.");
  const slot = ((await rangeSlots(c.env, biz, service, day, 1)).get(day) ?? []).find((s) => s.startsAt === startsAt);
  if (!slot) return again("That time has just been taken. Please pick another.", 409);

  const perDay = await db.prepare("SELECT COUNT(*) AS n FROM bookings b JOIN clients c ON c.id = b.client_id WHERE b.business_id = ? AND c.email = ? AND b.created_at > ?").bind(biz.id, st.email, iso(new Date(Date.now() - 86400_000))).first<{ n: number }>();
  if ((perDay?.n ?? 0) >= 5) return again("You've made several bookings today. Please contact the business directly.");

  const client = await db.prepare(
    `INSERT INTO clients (business_id, name, email, phone, marketing_ok) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (business_id, email) DO UPDATE SET name = excluded.name, phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE clients.phone END, marketing_ok = MAX(clients.marketing_ok, excluded.marketing_ok)
     RETURNING id`).bind(biz.id, st.name, st.email, st.phone, f.marketing ? 1 : 0).first<{ id: number }>();
  const token = randomToken(24);
  // Insert only if nothing overlaps. Doing the check inside the INSERT means two people can't take the same slot.
  const made = await db.prepare(
    `INSERT INTO bookings (business_id, service_id, client_id, starts_at, ends_at, notes, manage_token)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE business_id = ?1 AND status = 'confirmed' AND starts_at < ?5 AND ends_at > ?4)
     RETURNING id`).bind(biz.id, service.id, client!.id, slot.startsAt, slot.endsAt, st.notes, token).first<{ id: number }>();
  if (!made) return again("That time has just been taken. Please pick another.", 409);

  const at = new Date(slot.startsAt);
  c.executionCtx.waitUntil((async () => {
    await sendBookingEmail(c.env, made.id, "confirmation");
    if (biz.contact_email) await sendMail(c.env, { to: biz.contact_email, subject: `New booking: ${st.name}, ${fmtDayLong(at, biz.timezone)} at ${fmtTime(at, biz.timezone)}`,
      text: `${st.name} booked ${service.name}.\n\nWhen: ${fmtDayLong(at, biz.timezone)} at ${fmtTime(at, biz.timezone)}\nEmail: ${st.email}${st.phone ? `\nPhone: ${st.phone}` : ""}${st.notes ? `\nNote: ${st.notes}` : ""}\n\nSee your bookings: ${c.env.APP_URL}/app/${biz.slug}/bookings`, replyTo: st.email });
  })());
  return c.redirect(`/${biz.slug}/booking/${token}?new=1`);
});

/* a customer's own booking: confirmation, how to pay, and cancelling */
type Mine = { id: number; starts_at: string; status: string; service: string; price: string; duration_min: number; client: string };
const findMine = (env: Env, bizId: number, token: string) => env.DB.prepare(
  "SELECT b.id, b.starts_at, b.status, s.name AS service, s.price, s.duration_min, c.name AS client FROM bookings b JOIN services s ON s.id = b.service_id JOIN clients c ON c.id = b.client_id WHERE b.business_id = ? AND b.manage_token = ?").bind(bizId, token).first<Mine>();

app.get("/:slug/booking/:token", async (c) => {
  const biz = await findBiz(c.env, c.req.param("slug"));
  const b = biz && await findMine(c.env, biz.id, c.req.param("token"));
  if (!biz || !b) return c.notFound();
  const at = new Date(b.starts_at), methods = await payMethods(c.env, biz.id);
  const upcoming = b.status === "confirmed" && at.getTime() > Date.now();
  c.header("X-Robots-Tag", "noindex"); c.header("Referrer-Policy", "no-referrer");
  return c.html(
    <Page title={`Your booking · ${biz.name}`} style={brandStyle(biz)}>
      <div class="hero" style="padding:20px 0"><div class="wrap"><PublicTop biz={biz} /></div></div>
      <div class="wrap" style="max-width:640px;padding:28px 20px 56px">
        {b.status === "cancelled" ? <><h1>This booking was cancelled</h1><p class="muted" style="margin:6px 0 18px">You can book a new time whenever you like.</p></> :
          c.req.query("new") ? <><h1>You're booked, {b.client.split(" ")[0]}</h1><p class="muted" style="margin:6px 0 18px">We've emailed you the details. Keep this page's link if you need to cancel.</p></> :
          <><h1>Your booking</h1><p class="muted" style="margin:6px 0 18px">With {biz.name}.</p></>}
        <Flash ok={c.req.query("ok")} />
        <div class="card summary" style="position:static">
          <div class="r"><span>{b.service}</span><b>{b.price}</b></div>
          <div class="r"><span>When</span><b>{fmtDayLong(at, biz.timezone)}, {fmtTime(at, biz.timezone)}</b></div>
          <div class="r"><span>Length</span><b>{b.duration_min} min</b></div>
          {biz.address ? <div class="r"><span>Where</span><b style="text-align:right">{biz.address}</b></div> : null}
        </div>
        {methods.length && b.status !== "cancelled" ? <div class="card"><h2>How to pay</h2><PayList methods={methods} /><p class="hint" style="margin-top:10px">You pay {biz.name} directly. Wanlly Book doesn't take payments.</p></div> : null}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
          {upcoming ? <form method="post" action={`/${biz.slug}/booking/${c.req.param("token")}/cancel`}><button class="btn danger">Cancel this booking</button></form> : null}
          <a class="btn" href={`/${biz.slug}`}>Book another time</a>
          {biz.whatsapp ? <a class="btn" href={`https://wa.me/${biz.whatsapp}`} target="_blank" rel="noopener">Message on WhatsApp</a> : null}
        </div>
      </div><PublicFooter biz={biz} />
    </Page>);
});
app.post("/:slug/booking/:token/cancel", async (c) => {
  const biz = await findBiz(c.env, c.req.param("slug"));
  if (!biz) return c.notFound();
  const done = await c.env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE business_id = ? AND manage_token = ? AND status = 'confirmed' AND starts_at > ? RETURNING id").bind(biz.id, c.req.param("token"), iso(new Date())).first<{ id: number }>();
  if (done && biz.contact_email) {
    const b = await findMine(c.env, biz.id, c.req.param("token"));
    if (b) c.executionCtx.waitUntil(sendMail(c.env, { to: biz.contact_email, subject: `Cancelled: ${b.client}, ${fmtDayLong(new Date(b.starts_at), biz.timezone)}`, text: `${b.client} cancelled their ${b.service} on ${fmtDayLong(new Date(b.starts_at), biz.timezone)} at ${fmtTime(new Date(b.starts_at), biz.timezone)}.\n\nThat time is open for bookings again.` }));
  }
  return c.redirect(`/${biz.slug}/booking/${c.req.param("token")}`);
});

/* stop follow-up emails */
app.get("/:slug/unsubscribe/:token", async (c) => {
  const biz = await findBiz(c.env, c.req.param("slug"));
  if (!biz) return c.notFound();
  return c.html(<Page title={`Stop follow-up emails · ${biz.name}`} style={brandStyle(biz)}><div class="narrow">
    <h1 style="margin-bottom:8px">Stop follow-up emails?</h1><p class="muted" style="margin-bottom:16px">You'll still get confirmations and reminders for bookings you make with {biz.name}.</p>
    <Flash ok={c.req.query("ok")} />
    {c.req.query("ok") ? null : <form method="post" action={`/${biz.slug}/unsubscribe/${c.req.param("token")}`}><button class="btn pri">Stop follow-up emails</button></form>}
  </div></Page>);
});
app.post("/:slug/unsubscribe/:token", async (c) => {
  const biz = await findBiz(c.env, c.req.param("slug"));
  if (!biz) return c.notFound();
  await c.env.DB.prepare("UPDATE clients SET marketing_ok = 0 WHERE id = (SELECT client_id FROM bookings WHERE business_id = ? AND manage_token = ?)").bind(biz.id, c.req.param("token")).run();
  return c.redirect(`/${biz.slug}/unsubscribe/${c.req.param("token")}?ok=${encodeURIComponent("Done. You won't get any more follow-up emails.")}`);
});

app.notFound((c) => c.html(<Page title="Not found · Wanlly Book"><div class="narrow"><Logo /><h1 style="margin:24px 0 8px">We couldn't find that page</h1><p class="muted">Check the link, or go to the <a href="/">Wanlly Book home page</a>.</p></div></Page>, 404));
app.onError((err, c) => { console.error(err); return c.html(<Page title="Something went wrong · Wanlly Book"><div class="narrow"><Logo /><h1 style="margin:24px 0 8px">Something went wrong</h1><p class="muted">Please go back and try again.</p></div></Page>, 500); });

export default {
  fetch: app.fetch,
  // Runs every 15 minutes (see wrangler.jsonc) to send due reminders and follow-ups.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(runEmailJobs(env)); },
};
