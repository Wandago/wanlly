# Glowbook build plan

*Glowbook is a working name. Check trademarks and domains before using it.*

Glowbook is a booking app for lash and beauty studios that any studio can set up in about 10 minutes. Each studio gets a page that turns Instagram and WhatsApp traffic into paid bookings. It handles bookings, deposits and reminders, keeps a client list for follow-ups and retargeting, and puts WhatsApp chats in one inbox.

The clickable UI reference is `glowbook/index.html`.

## 1. Who it's for, and the first customer

- **First customer:** your cousin's lash studio. She uses every version as it's built, and her results decide what comes next.
- **Next:** other solo or small-team lash, brow and nail techs who get clients from Instagram and WhatsApp. Then hair, barbers and skin, which only need different service templates.
- **What makes it different from Fresha, Booksy, Vagaro or GlossGenius:**
  1. **WhatsApp-first.** Confirmations, reminders and follow-ups go out on WhatsApp, and her chats come into the app. Most rivals treat WhatsApp as an add-on.
  2. **A page built to convert ad traffic**, not just a listing on a marketplace next to her competitors.
  3. **Lash rules built in:** patch tests 48 hours before first sets, refill vs. full set timing, aftercare follow-ups and product upsells.

## 2. Decisions needed before building

| Decision | Why it matters | Options |
|---|---|---|
| **Country and currency** | Sets payment provider, pricing, tax, privacy law and WhatsApp prices | Ask your cousin |
| **Payment provider for deposits** | Deposits must go straight to the studio's own account | **Stripe Connect** (UK, EU, US and many others). **Paystack** (Nigeria, Ghana, Kenya, South Africa). **M-Pesa** via Safaricom's Daraja API (Kenya). |
| **WhatsApp route** | How messages are sent and who pays Meta | Start with **Meta's WhatsApp Cloud API** for her number. To onboard many studios, either become a Meta **Tech Provider** (lets studios connect their number themselves) or use a provider such as Twilio or 360dialog. |
| **Her current tool** | What we import and what she's switching from | Ask her: paper diary, Instagram DMs, Fresha, Booksy? |
| **Name and domain** | Each studio gets `studio.yourdomain.app` | Pick before launch |

## 3. What goes in version 1 (for your cousin, in about 6 weeks)

**In:**
- Studio page with her services, prices, gallery, reviews, policies and the sticky Book button
- Booking flow:
  - first visit vs. returning client
  - patch test rule
  - refill window rule
  - consultation questions
  - the two separate consents (reminders, and offers)
  - deposit payment
- Availability: working hours, breaks, days off, buffer time between clients, and a minimum notice period
- Owner views: Today, a week calendar, client list and client card, and manual bookings and blocks
- WhatsApp messages: confirmation, patch test reminder, 24-hour reminder with reply-to-confirm, aftercare tips, refill reminder
- Email as a fallback when a client has no WhatsApp
- Waitlist for full days

**Later:**
- Inbox with suggested replies
- Client groups and campaigns, and Meta ad audiences
- Aftercare shop
- Review requests
- Several staff per studio
- Self-serve setup and billing, so other studios can sign up without help
- Instagram's official Book button (needs Meta partner approval)

## 4. Stack

The same stack as the other projects in this repo, so setup carries over:

| Need | Choice | Notes |
|---|---|---|
| App (studio pages, booking, dashboard) | **Next.js + TypeScript** on **Cloudflare** (OpenNext adapter) | Studio pages are server-rendered and cached at the edge, so they load fast on phones |
| Database | **Neon Postgres** + Drizzle ORM | Every row carries a `business_id`, and every query is scoped by it |
| Owner sign-in | **Clerk** | One organisation per studio, so staff can be invited later. Clients don't need an account: they book with name and phone. |
| Images (gallery, logo) | **Cloudflare R2** | |
| Email | **Resend** | Owner emails and the client fallback |
| Scheduled messages | **Cloudflare Queues + Cron Triggers** | A job checks every few minutes for messages that are due |
| Holding a slot during checkout | Postgres row lock or a short "hold" record (about 10 minutes) | Prevents two people booking the same slot |
| Payments | Stripe Connect, Paystack or M-Pesa (see §2) | Card details never touch our servers |
| WhatsApp | Meta WhatsApp Cloud API, through webhooks | Incoming messages arrive by webhook. Outgoing ones use approved templates. |
| Retargeting | **Meta Pixel + Conversions API** on studio pages | Ad audiences built from opted-in clients only, with phone numbers hashed before upload |
| Errors and analytics | Sentry, PostHog | |

## 5. Data model (first version)

- `businesses`: name, slug, trade, time zone, currency, brand colour, policies, WhatsApp connection
- `staff`: for later. Version 1 has one staff member per business.
- `services`: name, group, duration, buffer, price, deposit, needs patch test, refill window (for example 21 days), active
- `availability_rules`: weekly hours, breaks. `time_off`: holidays, blocked times.
- `clients`: per business, unique by phone. Name, email, first visit date, last full set date, lash style, notes, total spent.
- `consents`: client, type (`service_messages` or `marketing`), granted or withdrawn, timestamp, where it was given (booking form, WhatsApp reply). Kept as a history, never overwritten.
- `consultations`: client, answers, date. **Allergy answers are health data** (see §8).
- `bookings`: client, service, start, end, status (`held`, `confirmed`, `completed`, `no_show`, `cancelled`), deposit, source (page, WhatsApp, manual, ad campaign)
- `patch_tests`: client, date, result
- `payments`: booking, provider, amount, status, provider ID
- `messages`: channel, direction, template, body, status (sent, delivered, read, failed), booking or client link
- `automations`: type, on/off, timing, template. `automation_runs`: what was sent to whom, so nothing is sent twice.
- `waitlist`: client, service, wanted days
- Later: `products`, `orders`, `campaigns`, `audiences`

## 6. The rules that need care

1. **Availability.** A free slot means: within working hours, not on a break or day off, enough time for the service plus buffer, no overlapping booking or hold, and after the minimum notice. Store all times in UTC and show them in the studio's time zone.
2. **Patch test.** It's needed if the client is new (or their last test is older than the studio's set limit, for example 6 months) **and** the service requires one. It must be at least 48 hours before the appointment. If no slot fits, say so clearly and suggest a later date.
3. **Refill vs. full set.** Offer a refill only if the last full set or refill was within the refill window. Otherwise show full sets. The studio sets the window.
4. **Deposits and cancellations.** The deposit is taken at booking. If the client reschedules more than 24 hours ahead, the deposit moves with them. Inside 24 hours, or for a no-show, the studio keeps it. Every rule is shown before the client pays.
5. **Messages are never sent twice.** Every automated message gets a unique key (booking plus message type) in `automation_runs` before it's sent.
6. **Reply to confirm.** A WhatsApp reply of "1" marks the booking confirmed and "2" sends reschedule options. Anything else goes to the inbox for the owner.
7. **Waitlist.** When a slot opens, message everyone on the waitlist who fits. The first to tap gets it, and the others are told it's gone.

## 7. Build phases

| Phase | What you get | Time |
|---|---|---|
| **0. Accounts and approvals** | Cloudflare, Neon, Clerk, Resend, the payment provider, a Meta Business account. **Start WhatsApp business verification and template approval on day one**, since they can take days or weeks. | Week 1 |
| **1. Studio page and booking (no payment)** | Services, availability, booking flow with patch test and refill rules, email confirmations. Your cousin starts taking real bookings. | Weeks 1–2 |
| **2. Deposits and owner views** | Deposit payments, cancellation rules, Today, the calendar, client cards, manual bookings | Weeks 3–4 |
| **3. WhatsApp messages** | Confirmation, reminders with reply-to-confirm, aftercare and refill reminders, the waitlist | Weeks 5–6 |
| **Checkpoint** | Your cousin runs her studio on it for 4 weeks. Track no-shows, rebooking rate and page conversion (see §10). | Weeks 7–10 |
| **4. Inbox and follow-ups** | Incoming WhatsApp chats in the app, suggested replies with booking links, review requests, the on/off follow-ups screen | 2–3 weeks |
| **5. Groups and campaigns** | Client groups, WhatsApp campaigns to opted-in clients, Meta ad audiences, and Pixel conversion tracking | 2 weeks |
| **6. Open to other studios** | Self-serve setup with trade templates, brand colour, connecting WhatsApp and payments, subscription billing, a landing page for Glowbook itself | 2–3 weeks |
| **Later** | Aftercare shop, multiple staff, gift cards, packages and memberships, Instagram Book button | |

## 8. Legal and trust rules

- **Two separate consents.** Service messages (confirmations, reminders) are part of the booking. Marketing messages (offers, win-backs, campaigns) need their own opt-in, which can be withdrawn by replying STOP. WhatsApp's own rules require opt-in for business messages too.
- **Health data.** Allergy and medical answers count as special category data under UK and EU law, and many other countries have similar rules. Collect only what's needed, ask for explicit consent, limit who can see it, and let clients delete it.
- **Retargeting.** Only opted-in clients go into ad audiences, phone numbers and emails are hashed before upload, and the studio page shows a cookie banner where the law requires one.
- **Payments.** Card details never touch our servers. Deposit and cancellation terms are shown before payment.
- **Each studio owns its data** and can export or delete its client list at any time.

## 9. Costs and pricing

| Item | Cost |
|---|---|
| Hosting, database, sign-in, email, storage | Free tiers until real traction |
| WhatsApp | Meta charges per template message, at rates that depend on category and country. Marketing costs the most; utility messages (confirmations, reminders) cost less. Replies within 24 hours of a client's message are free. Check current rates for her country. |
| Payments | The provider's fee per deposit, usually paid by the studio |
| Domain | About $10–20 a year |

**Plans (to test):**
- **Starter:** free, up to about 40 bookings a month, email reminders. Gets studios in the door.
- **Pro:** about $29 a month. WhatsApp messages, deposits, inbox, follow-ups and campaigns.
- Set Pro's price so it covers a busy studio's WhatsApp costs. Use her first month to measure how many messages a studio actually sends.

## 10. How we'll know it's working

Measured on your cousin's studio first:
- **Page to booking:** the share of studio page visitors who book. Aim for 5–10% from warm traffic (Instagram bio, WhatsApp).
- **No-show rate:** before and after deposits and reminders.
- **Rebooking:** the share of clients who book their refill within the window.
- **Time saved:** fewer "how much / are you free" messages answered by hand.
- **Follow-up results:** bookings that came from refill reminders and campaigns.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Meta approval for WhatsApp is slow | Start on day 1. Use email in the meantime. |
| WhatsApp costs eat the margin | Track messages per studio from month 1. Keep marketing sends opt-in and capped. |
| Double bookings | Slot holds plus a database check at confirmation |
| Studios won't move away from Instagram DMs | The inbox keeps chats in one place. Suggested replies make moving faster than staying. |
| Crowded market | Stay focused on WhatsApp-first studios that grow through Instagram, starting in her country |

## 12. Next steps

1. Answer the questions in §2, especially country, payment provider and her current tool.
2. Get her real services, prices, hours and policies, and load them into the prototype.
3. Start Meta Business verification and the WhatsApp number setup.
4. Build phase 1 and have her take her first real booking through it.
