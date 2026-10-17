# Wanlly Seen: build plan

Seen is a free directory at **seen.wanlly.africa** where Kenyan freelancers and small businesses get found. Every page is a portfolio: real work, starting prices, and a button to send a brief. It makes no money. Its job is to fix the problem that building Wanlly and Wanlly Sign showed us: good people and small products are very hard to find.

The UI reference is `prototype/index.html` (open it in a browser, no build step).

**Other names if "Seen" doesn't stick:** `find.wanlly.africa`, `folio.wanlly.africa`, `kazi.wanlly.africa` ("kazi" is Swahili for work).

## 1. Who it's for

- **People who need something done** search by what they need ("logo", "wedding photos", "M-Pesa shop") and town. They compare work and prices, then send a brief or tap WhatsApp.
- **Freelancers** (designers, photographers, developers, writers, MUAs, DJs) get one page that replaces a link-in-bio, a PDF portfolio and a Google Doc of prices.
- **Small businesses** (caterers, tailors, printers, studios, agencies) get the same, plus a team name.

Start in Kenya with creative and digital work, then add trades as the list grows.

## 2. What makes it different (and why people come back)

Directories die because owners claim a page once and never return, so the pages go stale and searchers stop trusting them. Each feature below gives an owner a reason to return or keep the page fresh.

| Feature | Why it brings people back |
|---|---|
| **Work first.** Search results show a photo of real work on every card, not a logo and a star rating. | Searchers can judge quality in seconds, which is the whole point. |
| **Fresh work ranks first.** Pages with new work in the last 30 days sort to the top. | The one ranking rule owners can control. They come back to post new jobs. |
| **Monthly "you were seen" email.** Views, search appearances, WhatsApp taps and briefs for the month. | Proof the page works. This is the main retention hook, and it costs one email a month. |
| **Briefs.** A client posts what they need, budget and deadline. We send it to up to 5 matching pages, and they reply directly. | Real leads arriving by email and WhatsApp. Nothing brings someone back like work. |
| **Your page is your link.** `seen.wanlly.africa/amina`, built to share on Instagram, WhatsApp status and email signatures. | Owners share it themselves, which brings new searchers and new owners. |
| **Kick-off with Wanlly Sign.** Once a client and freelancer agree, one button sends a simple agreement through Wanlly Sign. | Ties the Wanlly products together and protects both sides. |
| **Starting prices in KES.** Every service shows "from KES …". | Removes the "DM for price" step that loses most enquiries. |

No reviews at launch. Reviews need real, verified jobs to be fair, and fake or revenge reviews would hurt small businesses. Add them later only for jobs that went through a brief or a Wanlly Sign agreement.

## 3. Getting the first pages: "claim your page" outreach

Same approach as Wanlly Sign's law firm outreach: import a CSV, send a short sequence of emails slowly from our own domain, stop on reply or unsubscribe. The difference is what the email says: "Your business is on Seen. Claim it free to add your work, or remove it."

### Rules (these protect the domain and keep it legal)

Kenya's Data Protection Act 2019 covers personal data about people, and a one-person freelancer's name and email are personal data. Businesses' published contact details are lower risk, but the same care applies.

1. **Businesses can get an unclaimed page. Individual freelancers can't.** Unclaimed pages are only made for registered businesses whose details they published themselves (their website, Google Business profile, a public association list). Freelancers get an invite email instead ("reserve seen.wanlly.africa/yourname") and have no page until they sign up.
2. **Unclaimed pages show only public business facts:** name, category, town, website, and where the data came from with the date checked. No personal names, no personal phone numbers, no photos we didn't get permission for. Their contact email is never shown.
3. **The email only says what's true.** The page must already exist when we say "you're on Seen". No fake view counts, no "customers are trying to reach you".
4. **One click to remove.** Every unclaimed page and every email has "Remove this page". Removal deletes the page and adds the email and domain to a do-not-list, so a later import can't bring it back.
5. **Unclaimed pages are `noindex`** in search engines until claimed. They're findable on Seen but don't show up on Google under the owner's name without consent.
6. **Slow sending:** at most 25 a day at first, weekdays 8am to 5pm Kenya time, a first email and two follow-ups 5 working days apart, from `seen@wanlly.africa` with SPF, DKIM and DMARC set. Reuse `src/lib/outreach.ts` and `src/jobs/outreach.ts` from `wandago/wanlly-sign`.

### CSV columns

`business, email, category, town, website, phone, source` (with `business` and `email` required). `source` is where the details were found, shown on the page.

### Claiming

The owner opens the link from the email (it carries a one-time token), or finds the page and taps "Claim this page". We send a 6-digit code to the email already on the page, or by SMS to the published business phone. After that it's a normal account (Clerk, shared with the other Wanlly apps).

## 4. Stack

Same as Wanlly Sign, so the code and the deploy steps carry over.

- **Public pages (home, search, categories, profiles):** rendered as HTML by Hono on the Cloudflare Worker. Search engines need real HTML, and server-rendered pages load fast on slow phones. Cache them at Cloudflare's edge for a few minutes.
- **Owner screens (dashboard, editor) and admin:** React (Vite) app, the same setup as Wanlly Sign.
- **Data:** Neon Postgres with Drizzle. Search uses Postgres full-text search plus `pg_trgm` for typos. That's enough for tens of thousands of pages; move to a search service only if it isn't.
- **Images:** Cloudflare R2. Resize on upload to 3 sizes (card, page, full) as WebP so pages stay light on mobile data.
- **Sign-in:** Clerk, the same production instance as `wanlly.africa` and `sign.wanlly.africa`, so one account works everywhere.
- **Email:** the jobs app on HostAfrica sends over SMTP from `seen@wanlly.africa`, as in Wanlly Sign.
- **View counting:** one row per page per day (`page_views_daily`), bumped by the Worker. Bots are filtered by user agent and Cloudflare's bot score.

## 5. Tables

| Table | What it holds |
|---|---|
| `pages` | One per freelancer or business: slug, kind (freelancer/business), name, trade, town, about, WhatsApp, status (unclaimed/claimed/hidden), source, last_work_at |
| `page_owners` | Which Clerk user owns which page |
| `categories`, `page_categories` | The fixed category list and each page's categories |
| `works` | Portfolio pieces: page, title, image keys, client (optional), date |
| `services` | Name and starting price in KES |
| `briefs`, `brief_matches` | A client's brief and the pages it was sent to, with reply state |
| `page_views_daily` | page, day, views, search appearances, WhatsApp taps |
| `prospects`, `outreach_settings` | Copied from Wanlly Sign; prospects link to the unclaimed page they created |
| `do_not_list` | Emails and domains that asked to be removed. Checked on every import. |

## 6. Step by step

Each phase ends with something you can click on.

### Phase 0: Repo and accounts
1. Create `wandago/wanlly-seen` and copy the project setup from `wanlly-sign` (Vite, Hono, Drizzle, wrangler, the jobs app, CI).
2. New Neon database and R2 bucket. Reuse Clerk and the HostAfrica mailbox.
3. Add `seen.wanlly.africa` as a custom domain on the Worker.

### Phase 1: Public site
Home, search, category pages and profile pages, server-rendered, with example data. Mobile first.

### Phase 2: Owner accounts
Sign up as a freelancer or business, the page editor (work, services, prices, WhatsApp), image upload and resizing, and the "page strength" checklist.

### Phase 3: Outreach and claiming
CSV import that creates unclaimed business pages, the do-not-list, the claim flow with email or SMS code, and the 3-email sequence. Start with 25 a day and watch replies and removals for two weeks before raising it.

### Phase 4: Briefs
Post a brief, match it to up to 5 pages by category, town and price, notify by email (and WhatsApp later, through the WhatsApp Business API). Cap briefs per client per day to stop spam.

### Phase 5: Retention
The monthly "you were seen" email, the fresh-work ranking, and the Wanlly Sign "send agreement" button.

### Later
- Reviews, only for jobs that went through a brief or a Wanlly Sign agreement.
- More countries (Uganda, Tanzania, Rwanda), then towns as their own landing pages ("Photographers in Nakuru") for search engines.
- An "available from" date on each page so searchers can filter for people free this week.

## 7. Rules to keep from day one

- Free on both sides, no paid placement. If ranking can be bought, searchers stop trusting it.
- Nothing about a person is published without their consent.
- Every email can be stopped with one click, and a removal is permanent.
- The only ranking signals are relevance, town, and how recently the page added work.
