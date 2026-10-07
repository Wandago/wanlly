# Wanlly build plan

Wanlly is a free, ad-supported AI workspace with four tools (Chat, Code, Design, Images), one shared composer, and credits that people earn from opt-in sponsor spots. The UI reference is `prototype/index.html`.

## 1. What "free to set up" means

Everything below runs on free tiers **except model usage**. Every model call costs money, so you need a small budget from day one.

| Need | Free option | Watch out for |
|---|---|---|
| Hosting (web + API) | **Cloudflare Workers/Pages**, free plan | 100k requests/day and a 10 ms CPU limit per request. Waiting on a model stream doesn't count as CPU. Vercel's free plan bans commercial use, so it's out. |
| Database | **Neon** Postgres, free plan | About 0.5 GB storage per project. Scales to zero, so the first query after idle is slower. Branching gives each feature its own copy of the database. |
| Sign-in and user accounts | **Clerk**, free plan | Users live in Clerk, so a webhook copies each new user into Neon. Clerk sends its own sign-in emails. |
| File storage (generated images, uploads) | **Cloudflare R2**, free plan | 10 GB and a monthly cap on read/write operations. No egress fees. |
| Product email | **Resend**, free plan | 3,000/month with a 100/day cap. Only for product email, since Clerk handles sign-in mail. |
| Rate limiting, counters | Cloudflare KV / rate-limiting binding | Free tier write limits |
| Scheduled jobs (daily credit reset) | Cloudflare Cron Triggers | Free |
| GitHub access for Code mode | **GitHub App** | Free |
| Product analytics | PostHog, free tier | |
| Error tracking | Sentry, free tier | |
| Consent banner (required for ads in EU/UK) | Google "Privacy & messaging" (free, certified) | Required before you serve Google ads in EEA/UK |
| Domain | Free `*.pages.dev` subdomain to start | AdSense approval needs a real domain (about $10/yr) |

**Model spend, the one real cost:**
- Set a monthly spend limit in the Anthropic Console (and in OpenAI/xAI if you use them) **before** writing any code.
- Haiku 5.5 is $0.10 in / $0.50 out per 1M tokens, so a chat message is about $0.0006 and **$5 covers roughly 8,000 free messages**.
- Apply for startup credit programs (Anthropic, Google Cloud, AWS, Microsoft for Startups). They can cover months of usage.
- For building and testing only, some providers have free API tiers (Google Gemini, Groq, OpenRouter's free models, Cloudflare Workers AI). Check their current terms first: several forbid production use or train on your data.

## 2. Stack

- **App:** Next.js (App Router) + TypeScript, deployed to Cloudflare with the OpenNext adapter.
- **UI:** Tailwind CSS with our own design tokens copied from the prototype, plus Radix UI primitives for menus, dialogs and popovers. No pre-styled kit, so it doesn't look like every other AI app.
- **Data:** Neon Postgres via Drizzle ORM. Every query is scoped to the signed-in Clerk user on the server.
- **Auth:** Clerk (Google, GitHub, email). The `user.created` webhook inserts the user into Neon.
- **Files:** Cloudflare R2, with signed URLs for private files.
- **Models:** each provider's official SDK (`@anthropic-ai/sdk`, `openai`, xAI) behind one small `providers/` router of our own.
- **Images:** an image-generation API. Claude doesn't make images, so pick one of OpenAI's image models, Google's Imagen, or Flux via Cloudflare Workers AI. Workers AI has a free daily allowance.
- **Code sandbox:** decided in Phase 7 (E2B, Cloudflare Sandbox, or Claude Managed Agents). This is the one tool that needs real compute.

## 3. Step by step

Each phase ends with something you can click on.

### Phase 0: Accounts (one afternoon)
1. Create accounts: Cloudflare, Neon, Clerk, Resend, Anthropic Console, PostHog, Sentry. Turn on R2 in Cloudflare.
2. Set the Anthropic spend limit and create an API key. Store it only in Cloudflare secrets and `.env.local`, never in the repo.
3. Register a **GitHub App** named "Wanlly" with these permissions: Contents (read/write), Pull requests (read/write), Metadata (read).
4. Turn on Google, GitHub and email sign-in in Clerk.

### Phase 1: UI shell (no backend yet)
Turn the prototype into real components, each with a fake-data preview page at `/dev/ui`:
1. **Design tokens:** colors (light and dark), type scale, radius, spacing in one file.
2. **AppShell:** sidebar (recents, credit meter, account), top bar, and a mobile drawer.
3. **Composer:** text box, tool switch (Chat/Code/Design/Images), attachments, cost estimate, send button, and the out-of-credits message inside the composer.
4. **ModelPicker** and **CreditsPill**.
5. **Job**: the shared flow every tool uses. Prompt → `WorkingCard` → result → `SponsorLine`.
6. **SponsorSlot** and **RewardedPlayer**: both play inline, never in a pop-up.
7. **Result views:** markdown + code blocks (chat), steps + diff (code), image grid (images), sandboxed preview (design).
8. **Earn sheet:** spots, sponsor trials, streaks.
9. **Supporting pages:** sign-in, settings, the Plus upgrade page, empty states, error states, loading skeletons.
10. **Accessibility pass:** keyboard navigation, visible focus, reduced motion, screen-reader labels.

### Phase 2: Accounts and data
1. Clerk sign-in (Google, GitHub, email), plus the webhook that copies new users into Neon.
2. Tables: `profiles`, `conversations`, `messages`, `jobs`, `ledger_entries`, `ad_events`, `github_installations`.
3. Every query filters by the signed-in user ID on the server, so users only ever see their own rows.

### Phase 3: Chat (first real model call)
1. A `/api/chat` route that streams from the provider router. Default model is Haiku 5.5, and Sonnet 5.5 is unlocked with credits.
2. **Prompt caching** on the system prompt and conversation history, which cuts repeat input cost about 10x.
3. Charge credits from the **actual token usage** the API reports when the stream ends, not from an estimate. Refund on errors.
4. Rate limits per user and per IP (Cloudflare rate-limiting binding).

### Phase 4: Credits and ads
1. **The ledger is the source of truth:** credits = sum of `ledger_entries`. Never store a balance the browser can edit.
2. Daily free allowance through a cron job.
3. Ad slots behind one interface with swappable sources:
   - **Start:** house ads (your own promos) and **affiliate deals** with developer tools. These need no approval.
   - **Then:** Google AdSense / Ad Manager (display + rewarded) once the site has real content and a domain.
4. **The server grants rewards, never the browser.** Credits are only added after the ad network's server confirms the view. Add per-day caps and cooldowns.
5. Consent banner before any ad loads.

### Phase 5: Images
1. A `/api/images` route that calls the chosen image API and saves results to Cloudflare R2.
2. Flat price per job (for example 3 credits) and the same working card and sponsor flow.

### Phase 6: Design
1. The model returns HTML/React for the request.
2. Render it in a **sandboxed iframe** with no network access and no access to the parent page.
3. Keep versions so users can go back.
No extra service is needed, so it stays free.

### Phase 7: Code (most complex, most expensive)
1. User installs the GitHub App and picks repos.
2. The agent runs in an isolated sandbox: it clones the repo, edits, runs tests, and streams steps to the working card.
3. It opens a pull request through the GitHub App. It never pushes to `main`.
4. Haiku 5.5 by default. Bigger models cost credits, and every run has a hard token budget.

### Phase 8: Launch
1. Domain, privacy policy, terms, cookie/consent setup.
2. Apply for AdSense.
3. Stripe for the Plus plan (no monthly fee, only per-transaction).
4. Monitoring: Sentry alerts, a daily spend report, and abuse dashboards.

### Later: Plugins
Connect outside tools over MCP (Model Context Protocol), starting with GitHub, Google Drive and Notion. Sponsored plugins become a native ad format.

## 4. Money: how Wanlly pays for itself

Infrastructure is free until real traction. **AI usage is the only cost that grows with every user**, so the whole model comes down to this: revenue per active user must beat AI cost per active user.

### Rough cost per free user per month (ballpark, to be replaced with real data)

| Usage | Cost |
|---|---|
| 40 Haiku 5.5 chat messages (about $0.001 each with history) | $0.04 |
| 8 Sonnet 5.5 messages, paid for with ad-earned credits (about $0.01 each) | $0.08 |
| 2 generated images (depends on the image API) | about $0.06 |
| **Total** | **about $0.20** |

### Rough revenue per free user per month

These are industry ballparks, not quotes. In lower-income regions, ad rates can be 5 to 10 times lower than in the US/EU.

| Source | US/EU user | Lower-rate region |
|---|---|---|
| Sponsor lines under results (about 60 views at $1–3 per 1,000) | $0.06–0.18 | $0.01–0.03 |
| Rewarded spots (4 views at $0.01–0.03) | $0.04–0.12 | $0.01 |
| Sponsor trials and affiliate signups (averaged across users) | about $0.10 | about $0.03 |
| Plus plan ($8/mo, if about 2% upgrade, after their own AI usage) | about $0.10 | about $0.05 |
| **Total** | **about $0.30–0.50** | **about $0.10** |

The takeaway: ads alone roughly break even. **Sponsor deals with developer tools and the Plus plan carry the margin.**

### By stage

| Stage | Monthly active users | Infra | AI | Revenue |
|---|---|---|---|---|
| Building | 0–50 | $0 | $5–10 (testing) | $0 |
| Early launch | about 1,000 | $0 | about $200 | Close to $0 at first, because ad networks need approval and traffic |
| Growing | about 10,000 | about $30–50 (Workers paid plan $5, Neon paid plan) | about $2,000 | about $2,000–4,000 if the mix above holds |

**The gap is early launch.** Cover it with startup credits (Anthropic, Google for Startups, AWS Activate, Microsoft for Startups, Cloudflare for Startups) and a personal cap you're comfortable losing, for example $20–50/month.

### Rules that keep it solvent

1. **A hard daily AI budget**, both for the whole app and per user. If the day's budget runs out, free users fall back to Haiku or wait. Nobody can run up a surprise bill.
2. **Rewards follow what the ad actually paid.** Credits per spot are set from that ad's real payout (about 70% of it back to the user). A spot in a low-rate country earns fewer credits.
3. **Haiku 5.5 is the free default.** Bigger models cost earned credits or need Plus.
4. **Code mode runs on credits or Plus only**, with a token budget per run.
5. **Abuse control from day one:** verified sign-up, rate limits, reward caps. Bots are the fastest way to lose money.
6. **Track one daily number:** AI cost per active user vs revenue per active user, overall and by country.

## 5. Rules to keep from day one

- Sponsors never appear inside a model's answer and never change it.
- Every ad is labeled and optional. Nobody is blocked after a result is ready.
- Use official provider APIs only. No proxying consumer subscriptions like Copilot or ChatGPT Plus.
- Secrets live in environment variables, never in the repo.
