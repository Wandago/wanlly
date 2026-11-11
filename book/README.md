# Wanlly Book

Free booking pages for any business, at `book.wanlly.africa`.

A business signs up with its email, picks its industry and gets a booking page at `book.wanlly.africa/its-name`. Customers pick a time in any browser, and both sides get an email. Reminders and follow-ups send themselves. Each business lists how it wants to be paid (M-Pesa, bank transfer, cash and so on). Wanlly Book never takes or holds money.

## What works today

- **Sign-in by email link.** No passwords. Links work once and expire after 15 minutes.
- **Setup in a minute.** Choosing an industry (beauty, health, real estate, fitness or other) sets the wording and adds starter services and a follow-up email.
- **Booking page** with the business's colour, services, prices, payment methods and a WhatsApp chat button.
- **Booking flow.** Only free times inside opening hours are offered, and two people can't take the same time.
- **Customers manage their own booking** from a private link: see how to pay, or cancel.
- **Automatic emails:** confirmation, reminder (hours before) and follow-up (days after), each editable. Follow-ups only go to people who ticked the box, and every one has a link to stop them.
- **Dashboard:** today, bookings, customers, services, opening hours, payment methods, emails, booking page settings.
- **Team and roles:** owner, manager, staff, front desk. Staff and front desk see bookings and customers but not settings.

## How it's built

| Part | Choice | Cost |
|---|---|---|
| App and hosting | Cloudflare Workers, using the Hono framework | Free plan: 100,000 requests a day |
| Database | Cloudflare D1 (SQLite) | Free plan: 5 GB |
| Scheduled emails | Cloudflare Cron Trigger, every 15 minutes | Free |
| Sending email | Resend | Free plan: 3,000 emails a month, 100 a day |

Everything is server-rendered HTML with one small stylesheet and almost no JavaScript, so pages load fast on slow phones.

```
src/index.tsx     public pages: home, sign-in, booking pages, booking flow, scheduled job
src/app.tsx       the dashboard at /app
src/booking.ts    free-time lookup, booking emails, the reminder and follow-up job
src/time.ts       time zones and slot calculation (tested in test/time.test.ts)
src/auth.ts       sign-in links and sessions
src/mail.ts       email sending
src/templates.ts  industries, default emails, payment types, colours
migrations/       database schema
public/           stylesheet and a small script
```

## Run it on your computer

```bash
npm install
```

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run db:local
```

```bash
npm run dev
```

Open http://localhost:8787. In development no email is sent: the sign-in link is shown on screen, and other emails are printed in the terminal.

Checks:

```bash
npm test
```

```bash
npm run typecheck
```

## Put it online

You need a Cloudflare account with the `wanlly.africa` domain added to it, and a Resend account.

1. **Sign in to Cloudflare from the terminal.**
   ```bash
   npx wrangler login
   ```
2. **Create the database.** Copy the `database_id` it prints into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_ID`.
   ```bash
   npx wrangler d1 create wanlly-book
   ```
3. **Create the tables.**
   ```bash
   npm run db:remote
   ```
4. **Set up email in Resend.** Add the domain `wanlly.africa`, add the DNS records Resend shows you in Cloudflare, and wait for it to verify. Create an API key, then save it as a secret:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
5. **Deploy.**
   ```bash
   npm run deploy
   ```
6. **Connect the address.** In the Cloudflare dashboard, open the `wanlly-book` Worker, go to Settings → Domains & Routes, and add the custom domain `book.wanlly.africa`.

`APP_URL` and `MAIL_FROM` are set in `wrangler.jsonc`. Change `MAIL_FROM` if you want a different sender address.

## Limits to know about

- **Email is the first limit you'll hit.** Resend's free plan allows 100 emails a day and 3,000 a month, shared by every business on Wanlly Book. Each booking uses about 3 (customer confirmation, alert to the business, reminder), so the free plan covers roughly 30 bookings a day. Past that, Resend's paid plan is needed.
- **One calendar per business.** Everyone on a team shares one diary for now.
- **No rescheduling yet.** Customers cancel and book again.

## Before real businesses use it

- Add a privacy policy and terms of use. The app stores customers' names, emails and phone numbers, so data-protection law applies (for example Kenya's Data Protection Act).
- Health businesses collect sensitive information. Don't market to clinics until notes, access and hosting have been reviewed for that.

## Next steps

1. Days off and holidays.
2. Rescheduling from the customer's link.
3. A calendar per staff member.
4. Group bookings with a number of places (classes, open houses).
5. Industry rules from the prototype, such as a patch test before a first lash set.
6. A logo and photos on the booking page.
