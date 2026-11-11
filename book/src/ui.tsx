/** Shared page shells. Views use hono/jsx, which escapes text by default. */
import type { Child } from "hono/jsx";
import { brandOf, industryOf } from "./templates";
import type { Business, User } from "./types";

export const Page = (p: { title: string; children: Child; style?: string }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{p.title}</title>
      <link rel="stylesheet" href="/app.css" />
    </head>
    <body style={p.style}>{p.children}</body>
  </html>
);

export const Logo = (p: { href?: string }) => (
  <a class="logo" href={p.href ?? "/"}><i>W</i>Wanlly Book</a>
);

export const Flash = (p: { ok?: string; err?: string }) => (
  <>
    {p.ok ? <div class="flash" role="status">{p.ok}</div> : null}
    {p.err ? <div class="flash err" role="alert">{p.err}</div> : null}
  </>
);

/** Which roles may open the settings screens. Staff and front desk only see bookings and customers. */
export const canManage = (role: string) => role === "owner" || role === "manager";

export const AppShell = (p: { user: User; biz: Business; role: string; active: string; title: string; children: Child; ok?: string; err?: string }) => {
  const ind = industryOf(p.biz.industry);
  const base = `/app/${p.biz.slug}`;
  const link = (key: string, href: string, label: string) => <a href={href} aria-current={p.active === key ? "page" : undefined}>{label}</a>;
  return (
    <Page title={`${p.title} · ${p.biz.name}`}>
      <header class="top"><div class="in">
        <Logo href="/app" />
        <span class="pill">{p.biz.name}</span>
        <div class="sp">
          <a class="btn sm" href={`/${p.biz.slug}`} target="_blank" rel="noopener">View booking page</a>
          <span class="muted email">{p.user.email}</span>
          <form method="post" action="/logout" class="inline"><button class="btn sm">Sign out</button></form>
        </div>
      </div></header>
      <div class="shell">
        <nav class="side" aria-label="Sections">
          <div class="gl">Day to day</div>
          {link("today", base, "Today")}
          {link("bookings", `${base}/bookings`, "Bookings")}
          {link("clients", `${base}/clients`, ind.clients)}
          {canManage(p.role) ? (<>
            <div class="gl">Set up</div>
            {link("services", `${base}/services`, ind.items)}
            {link("hours", `${base}/hours`, "Opening hours")}
            {link("payments", `${base}/payments`, "Payment methods")}
            {link("emails", `${base}/emails`, "Emails")}
            {link("page", `${base}/page`, "Booking page")}
            {p.role === "owner" ? link("team", `${base}/team`, "Team and roles") : null}
          </>) : null}
        </nav>
        <main class="main"><Flash ok={p.ok} err={p.err} />{p.children}</main>
      </div>
    </Page>
  );
};

export const brandStyle = (biz: Business) => {
  const b = brandOf(biz.brand);
  return `--deep:${b.deep};--accent:${b.accent};--on-accent:${b.onAccent};--soft:${b.soft}`;
};

export const PublicFooter = (p: { biz: Business }) => (
  <footer class="pfoot"><div class="wrap">
    <b style="color:#fff">{p.biz.name}</b>{p.biz.address ? <> · {p.biz.address}</> : null}{p.biz.phone ? <> · {p.biz.phone}</> : null}
    <div style="margin-top:6px">Bookings by <a href="/">Wanlly Book</a>. Free booking pages for any business.</div>
  </div></footer>
);
