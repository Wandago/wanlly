# Ratecard: pricing checker for local businesses

*Ratecard is a working name. Check trademarks and domains before using it.*

A business owner enters their services, prices and location. Ratecard finds nearby competitors, reads their public price lists, and shows where each service sits in the local market, with a suggested price and the reason for it. It then keeps watching and alerts the owner when a competitor changes prices.

The clickable UI reference is `pricing/prototype/index.html`.

## 1. Who it's for, and who to start with

| Segment | Do competitors publish prices? | Fit |
|---|---|---|
| **Hair and beauty salons, barbers, nail and lash studios** | Usually, on their website or booking page | **Start here.** Lots of businesses, many comparable services, and prices are public. |
| Gyms, yoga and pilates studios | Often (memberships, class packs) | Good second segment. Fewer services per business, but higher prices. |
| Trades (plumbers, electricians, cleaners) | Rarely. Most say "call for a quote" | Weak at launch. Needs other data sources (see §3), so add it later. |

**Launch with salons and barbers in one city.** One city means fewer places to scan and lets you check the data quality by hand.

## 2. Check demand before writing code (1–2 weeks)

1. Pick 10 salons in your area. Collect their competitors' prices by hand into a spreadsheet: about 2 hours per salon.
2. Send each owner a one-page report like the prototype's, then ask: *"Would you pay $19/month to keep this updated and get alerts?"*
3. Go ahead if at least 3 out of 10 say yes or change a price. If not, try gyms the same way before building anything.

Doing it by hand also shows you which services are hard to match, which is the hardest part of the product.

## 3. How the data works

This is the core of the product. Everything else is a normal web app.

### Step 1: Find competitors
- **Google Places API** (Text Search / Nearby Search) by category and radius, which returns name, website, rating, review count and location. It is paid per request with a free monthly allowance, so check current pricing and cache results for 30 days.
- **OpenStreetMap (Overpass API)** is a free fallback, but has fewer websites listed.
- The owner can add or remove competitors by hand. They usually know their real rivals better than a radius does.

### Step 2: Read prices
- Fetch the competitor's website, find the price or menu page (links named "prices", "menu", "services"), and render it with **Cloudflare Browser Rendering** if the page needs JavaScript to load.
- **Claude Haiku 5.5** extracts a list of `{service, price, price_type (from / fixed / range), duration, notes}` from the page text. Haiku costs about $0.002 per page, so a 15-competitor scan is about $0.03.
- Save a snapshot of every page to R2 so each price can be traced back to its source.
- **Booking platforms** (Fresha, Booksy, Treatwell, Mindbody) show prices publicly, but their terms usually forbid scraping. Only use them through an official partner API or with permission.
- **Respect robots.txt**, add per-domain rate limits, and use a clear user agent.

### Step 3: Match services
"Ladies cut & finish", "Women's restyle" and "Cut + blow wave" are the same service. This is the hardest step.
- Keep a fixed **service list per industry** (for example about 60 standard salon services).
- Haiku maps each extracted item to a service on that list with a confidence score. Low-confidence matches are left out of comparisons and shown as "unmatched" so the owner can fix them. Their fixes improve future matching.
- Record **hair length / duration modifiers** when given ("from $60" or "long hair +$15"), since they change the comparison.

### Step 4: Compare and suggest
For each service, compute low, 25th percentile, median, 75th percentile and high across matched competitors. Only show a comparison when there are **at least 4 matched prices**.

The owner chooses a **positioning** (budget / mid-market / premium), which sets the target percentile. A service is:
- **Underpriced** if below the 25th percentile: suggest moving toward the target.
- **In line** if within the middle band.
- **Above market** if above the 75th percentile: no automatic suggestion to cut. Show whether their rating and reviews support the higher price.

Suggestions are rounded to the business's usual price endings (for example $5 steps). The **estimated monthly impact** is (suggested − current) × the owner's weekly bookings × 4.33. It is shown as an estimate and assumes no bookings are lost.

Claude writes a one-sentence reason for each suggestion from the numbers only, for example "8 of 11 salons within 3 km charge more; your 4.8★ rating is above the local median of 4.5★". The model never invents prices.

### Step 5: Keep watching
A weekly cron job re-reads each competitor's price page. If it changed, it re-extracts prices, records the change, and sends an email alert through Resend.

### Data for trades (later)
- **Owner-shared data:** users opt in to share their own prices anonymously. Only show a figure when it combines **at least 5 businesses**, so nobody's prices can be singled out.
- Published industry price guides and job-cost surveys.
- Lead sites that show price ranges, but only where their terms allow it.

## 4. Legal and trust rules

- **Competition law:** Ratecard gives advice to one business, based on public prices. It must never share one customer's private data with a competitor, suggest that competitors "align" prices, or act as a channel between competitors. Shared data is anonymous, only shown when it combines 5 or more businesses, and only appears as ranges. Get a short legal review before launching owner-shared data.
- Only public pages. No logging in, no getting around paywalls, robots.txt respected, booking platform terms respected.
- Every price links to its source and the date it was checked. Old prices are marked as stale after 60 days.
- Suggestions are labeled as estimates, and the owner always decides.

## 5. Stack

The same free-tier stack as Wanlly, so accounts and setup carry over:

- **App:** Next.js + TypeScript on Cloudflare (OpenNext), Tailwind, Radix UI.
- **Auth:** Clerk. One organisation per business, so staff can be invited.
- **DB:** Neon Postgres + Drizzle. Tables: `businesses`, `services`, `competitors`, `price_pages`, `observed_prices`, `service_matches`, `suggestions`, `alerts`.
- **Crawling:** Cloudflare Queues (one message per competitor page) + Browser Rendering, with Cron Triggers for the weekly re-check.
- **Storage:** R2 for page snapshots.
- **Email:** Resend for reports and alerts.
- **Models:** Haiku 5.5 for extraction and matching, Sonnet 5.5 only for the written summary at the top of the report.
- **Payments:** Stripe.

## 6. Build phases

| Phase | What you get | Time |
|---|---|---|
| 0. Check demand by hand | 10 hand-made reports and a yes/no on demand | 1–2 weeks |
| 1. Data pipeline (no UI) | A script that, given a location, finds salons, reads prices, matches services and prints a comparison | 2 weeks |
| 2. Accuracy | A tested sample of 200 prices checked by hand. Aim for over 90% correct extraction and over 85% correct matching | 1 week |
| 3. App | Sign-up, onboarding, scanning screen, report, competitor list, service detail | 2–3 weeks |
| 4. Watching | Weekly re-check, alerts, price history chart | 1 week |
| 5. Billing and launch | Stripe, free first report, landing page, one city | 1 week |
| 6. Next segment | Gyms and studios, then trades with owner-shared data | Later |

## 7. Pricing and costs

| Plan | Price | What's included |
|---|---|---|
| Free check | $0 | One scan with 3 services fully shown and the rest blurred. This is how people find the product. |
| Single location | $19/month | All services, unlimited re-scans, weekly alerts, price history |
| Multi-location | $49/month | Up to 5 locations, comparison across locations, staff seats |

**Cost per paying business:** about 15 competitors × 4 re-checks a month × about $0.003 (page fetch + Haiku extraction) = **about $0.20/month**, plus Places API lookups that are cached. Margins are high. The real costs are finding customers and keeping the data accurate.

**How to find customers:** the free check is the hook ("See how your prices compare in 60 seconds"). After that: salon Facebook groups, local business associations, partnerships with salon suppliers and booking-software resellers, and short videos showing a real (anonymised) report.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Competitor prices are wrong or out of date | Link every price to its source, show the check date, require at least 4 prices, let owners flag mistakes |
| Competitors block crawling | Accept it, and fall back to owner-added prices and shared data |
| Services are matched wrongly | Fixed service list, confidence threshold, owner corrections |
| Owners raise prices and lose clients | Frame suggestions as estimates, suggest trying one service first, track booking changes later (once booking software is connected) |
| Too few customers keep paying after the first report | Alerts and price history give a reason to keep paying. Tested in phase 0. |
