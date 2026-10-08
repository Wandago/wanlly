# Wanlly build plan

Wanlly is a free AI workspace with four tools (Chat, Code, Design, Images) in one composer, paid for by ads. People get a daily allowance on every model, sized by what their own ads earn, and can extend it by watching video spots. No paywall and no "bring your own API key".

- Cost and revenue model, by region and model: [`docs/ad-economics.html`](ad-economics.html) (also published as an interactive page)
- UI reference: the running app on `feature/ui-shell`, and `/dev/ads` for every ad format

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Who pays | **Ads only at launch.** Sponsorship deals come later, once there are users to show. |
| Paywall | None for now. A Plus plan is an optional extra for later. |
| Own API keys | Not offered. The point of Wanlly is free access. |
| Models | **Haiku 5.5** first for quick work and the bulk steps of every build. **Sonnet 5.5** is the default for building. **Opus 5.5** for the hard parts. **Fable 5.1** for a few big prompts. GPT, Codex and Grok follow the same rules once added. |
| How usage is counted | **Tokens**, priced per model. Every model draws from the same budget, so bigger models use it faster. |
| Limits | Like Claude: a **5-hour window** (about 60% of the day's budget), a **weekly cap** (about 5 days' worth), and a **countdown** when either runs out. When it runs out, people wait, watch a video, or switch to Haiku. |
| Allowance by region | Each person's budget = **70% of what their own ads earned**, measured over time, plus a **minimum for everyone**. Country comes from Cloudflare at sign-up, but measured ad revenue decides, so VPNs don't help. |
| Ad formats | Native sponsor card while a job runs, a 336×280 / 300×250 rectangle, inline video (16:9, 9:16, 1:1), a result line or 320×50 banner, a side panel that stays up while people work (desktop), a pinned bottom banner (phones), and a Build Pass (a video about every 15 minutes during long builds). |
| Ad rules | Every ad is labeled. Nothing appears inside an answer. Nothing blocks a finished result. **Never reward clicks**: rewards come from opt-in videos only. |
| Video rewards | Credits follow what each video actually paid, so a cheap video never loses money. Several ad networks bid, so prices drop more slowly. |

---

## 2. Stack (all free tiers except AI usage)

| Need | Service | Watch out for |
|---|---|---|
| Hosting | **Cloudflare Workers/Pages** | 100k requests/day free. Commercial use allowed. |
| Database | **Neon** Postgres | About 0.5 GB free. Slower first query after idle. |
| Sign-in | **Clerk** | A webhook copies each new user into Neon. |
| Files (images, uploads) | **Cloudflare R2** | 10 GB free, no download fees. |
| Product email | **Resend** | 3,000/month, 100/day. |
| Limits, counters, rate limits | Cloudflare KV + rate limiting | |
| Daily and weekly resets | Cloudflare Cron Triggers | |
| Code mode repo access | **GitHub App** | |
| Analytics, errors | PostHog, Sentry | |
| Ads | Google AdSense first, then Google Ad Manager plus other video networks | AdSense needs a real domain and real content before it approves you. |
| Consent banner | Google "Privacy & messaging" | Required before ads load in the EU/UK. |
| AI | Anthropic API (official SDK) behind our own model router | **The one real cost.** Set a spend limit before anything else. |

App code: Next.js 16 + TypeScript + Tailwind, deployed to Cloudflare with the OpenNext adapter.

---

## 3. Step by step

Each step says who does it. **You** = Louis, after work and on weekends. **Claude** = me, in a session like this one. Most steps end with something you can click.

### Step 0: Accounts and keys (you, about 2 hours, this weekend)
1. Create accounts: **Cloudflare, Neon, Clerk, Resend, Anthropic Console, PostHog, Sentry.** Turn on R2 in Cloudflare.
2. In the Anthropic Console, **set a monthly spend limit first** ($20 is plenty while building), then create an API key.
3. Buy a domain (about $10/year). AdSense needs one, and it makes the launch look real. Point it at Cloudflare.
4. In Clerk, turn on Google, GitHub and email sign-in.
5. Send me the **non-secret** values: the Clerk publishable key, the Neon project name and the domain. **Never paste secret keys in chat.** I'll tell you where to put each one.
6. Apply for startup credits where you qualify (Anthropic, Google for Startups, AWS Activate, Microsoft for Startups, Cloudflare for Startups). They're forms, not negotiations, and can cover months of AI.

### Step 1: UI shell ✅ done
The app on `feature/ui-shell`: sidebar, model picker, credits, one composer with the tool switch, the shared job flow, inline video spots, the earn sheet, and responsive ad slots in every format (`/dev/ads`). Replies, credits and ads are still simulated.

### Step 2: Sign-in, database, deploy (Claude builds, you test)
1. Clerk sign-in, and the webhook that copies new users into Neon.
2. Tables: `users` (with country), `conversations`, `messages`, `jobs`, `usage_ledger`, `ad_events`, `models`.
3. Deploy to your domain on Cloudflare, so every later step is live.
4. **You:** sign up on the live site and click around.

### Step 3: Real chat with limits (Claude builds, you test)
1. Model router with Haiku 5.5, Sonnet 5.5, Opus 5.5 and Fable 5.1, streaming replies.
2. Prompt caching, and summarizing long chats so requests stay small.
3. **Token metering:** every reply records the actual tokens and cost the API reports.
4. **Limits:** daily budget, 5-hour window, weekly cap, the minimum for everyone, a countdown, and a meter showing what's left on each model.
5. **A global safety cap:** if total AI spend for the day hits your limit, free usage pauses with a clear message. You can never get a surprise bill.
6. **You:** use it every day for a week and note anything that feels wrong.

### Step 4: Ads, first version (Claude builds, you apply)
1. **Before AdSense approves you:** fill the slots with house ads (your own "invite a friend" and launch messages) and **self-serve affiliate programs** from developer tools. Those are sign-up forms with no negotiation, unlike sponsorship deals.
2. **You:** apply for AdSense once the site has a few real pages (home, about, privacy, terms, a public gallery). Approval can take days to weeks.
3. Consent banner. Ad events logged per user and country, so allowances follow real revenue.
4. Video spots: the server grants credits only after the ad network confirms the view.
5. Phones: a pinned bottom banner. Desktop: the side panel.

### Step 5: Images and Design (Claude builds)
1. Images through an image API, saved to R2, with a flat token-based price.
2. Design: the model writes HTML/React, shown in a locked-down preview with version history.

### Step 6: Code and Build Pass (Claude builds)
1. GitHub App install and repo picker.
2. The agent works in an isolated sandbox: Haiku does the bulk steps, Sonnet or Opus the hard ones. It opens a pull request and never pushes to `main`.
3. **Starter templates** (sign-in, database and deploy already set up), so builds don't start from zero.
4. **Build Pass:** side panel on and a video about every 15 minutes while long builds run.
5. **"Build overnight" queue:** jobs that can wait run through the batch API at half price.

### Step 7: Launch (mostly you)
1. Privacy policy, terms, contact page.
2. **Invite-only beta first** (a waitlist), so you control cost while the ads ramp up.
3. Open up once ad revenue per user is measured and the limits hold.

### Later
- Sponsorship deals (compute pools, "Today's Sonnet is brought to you by", local sponsors) once you have users and numbers to show.
- Several video ad networks bidding through Google Ad Manager.
- GPT, Codex and Grok in the model router.
- Plugins over MCP (GitHub, Google Drive, Notion).
- An optional Plus plan.

---

## 4. Getting users (you, starting now)

The product won't promote itself, so start before it's finished.

1. **Build in public from this weekend.** Short posts and screen recordings on X, TikTok, LinkedIn and Instagram: "I'm building a free AI workspace paid for by ads." Show the UI, the ad formats, the economics page.
2. **Waitlist page on your domain** in Step 2, with a "skip the line by inviting friends" link.
3. **Your home developer communities:** university tech clubs, local developer groups and WhatsApp/Telegram communities in Kenya, Nigeria and across Africa and Asia, the people Wanlly is built for.
4. **Referral credits:** invite a friend who signs up and both get extra allowance. Cheap to give, and the best growth channel for a free product.
5. **Public gallery** of things people built with Wanlly (with their permission). Good for sharing, search traffic and AdSense approval.
6. **Launch days** when the beta opens: Product Hunt, Hacker News "Show HN", relevant Reddit communities (read each one's rules on self-promotion first).
7. **Small challenges you run yourself:** "Build a tool for your community this weekend", with extra allowance as the prize.

---

## 5. Money

Full model: `docs/ad-economics.html`. All numbers are estimates until real data comes in.

**What a free user gets per day** ("Daily use", 15-minute minimum for everyone):

| Region | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|---|
| Africa, South and Southeast Asia, Latin America | 1h 34m building / 125 messages | 15 min / 12 | 8 min / 6 | 2 messages |
| Western Europe | 3h 22m / 269 | 32 min / 26 | 18 min / 13 | 4 messages |
| North America | 4h 45m / 379 | 46 min / 37 | 25 min / 18 | 6 messages |

**At launch, revenue is close to zero:** ad networks need approval and traffic first, and you have no sponsors yet. So:
- AI cost during the beta comes from your own budget plus any startup credits. **Pick a monthly number you're comfortable losing** ($20–50) and set it as both the Anthropic spend limit and Wanlly's global safety cap.
- Start the minimum for everyone small (for example 10 minutes of Sonnet a day) and raise it as ad revenue comes in. It's a setting, not code.
- Keep the beta invite-only until revenue per user is measured.

**Rules that keep it solvent:**
1. Every token is counted. No model is unlimited.
2. Each person's allowance follows what their own ads actually earned.
3. A global daily safety cap on total AI spend.
4. Video rewards follow what each video paid.
5. Verified sign-up (one person, one allowance), rate limits and reward caps. Bots are the fastest way to lose money.
6. Watch one number every day: AI cost vs ad revenue, overall and by country.

---

## 6. Keeping up with new models

1. Models live in the `models` table (name, prices, tools, on or off), so a new one goes live without a code release.
2. A daily check of each provider's model list, with an alert when a new model appears.
3. A fixed test set of about 40 real Wanlly tasks, run on every new model before it becomes a default.
4. The model router absorbs API changes (new models often change settings).
5. New-model launches are content: "Haiku 5.5 is live on Wanlly" is a post and a reason for people to come back.

---

## 7. Rules to keep from day one

- Sponsors never appear inside a model's answer and never change it.
- Every ad is labeled. Rewards only for opt-in video views, never for clicks.
- Use official provider APIs only. No proxying consumer subscriptions like Copilot or ChatGPT Plus.
- Secrets live in environment variables, never in the repo or in chat.
