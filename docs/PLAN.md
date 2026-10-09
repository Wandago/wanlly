# Wanlly build plan

Wanlly gives people frontier AI with four tools (Chat, Code, Design, Images) in one composer, paid for by ads. There is no free tier: everyone starts with zero credits and earns them by watching ads, and their allowance on every model is sized by what their own ads earned. No paywall and no "bring your own API key".

- Cost and revenue model, by region and model: [`docs/ad-economics.html`](ad-economics.html) (also published as an interactive page)
- UI reference: the running app on `feature/ui-shell`, and `/dev/ads` for every ad format
- Anti-abuse architecture: [`docs/SECURITY.md`](SECURITY.md)
- Launch plan, beta process and tracking: [`docs/LAUNCH.md`](LAUNCH.md); pages `/beta` and `/admin` (design previews)
- Every screen, start to finish: [`docs/journey.html`](journey.html) (clickable storyboard)
- Legal and compliance checklist: [`docs/LEGAL.md`](LEGAL.md)
- Deploying to Cloudflare and the Clerk webhook: [`docs/DEPLOY.md`](DEPLOY.md)
- Ad partners, by stage, and how to choose them: [`docs/AD-PARTNERS.md`](AD-PARTNERS.md)
- System architecture and flowcharts: [`docs/architecture.html`](architecture.html)
- Brand: the Wanlly design system (logo set, colours, type, voice), with the logo files in `public/brand/`

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Who it's for | **Students and under-resourced creators anywhere in the world**: people with ideas and no budget for AI subscriptions. Not one region. |
| Who pays | **Ads only at launch.** Then **student-friendly advertisers** buy directly (see "Student-friendly advertisers" below) once there are users to show. |
| Free tier | **None.** New accounts start at zero credits. Each day a person unlocks their allowance by watching one video, which is also a bot check. |
| Credits | **Every video earns credits (4); the first video each day earns a bonus (8).** No user-facing pool or per-country promises. |
| Paywall | None for now. A Plus plan is an optional extra for later. |
| Own API keys | Not offered. The point of Wanlly is free access. |
| Models | **Haiku 5.5** first for quick work and the bulk steps of every build. **Sonnet 5.5** is the default for building. **Opus 5.5** for the hard parts. **Fable 5.1** for a few big prompts. GPT, Codex and Grok follow the same rules once added. |
| How usage is counted | **Tokens**, priced per model. Every model draws from the same budget, so bigger models use it faster. |
| Limits | Like Claude: a **5-hour window** (about 60% of the day's budget), a **weekly cap** (about 5 days' worth), and a **countdown** when either runs out. When it runs out, people wait, watch a video, or switch to Haiku. |
| Allowance | **The bigger of:** the community floor, or 70% of what their own ads earned. Watching more always adds more. Measured ad revenue decides, not the country someone claims, so VPNs don't help. |
| Abuse | Layered defences in `docs/SECURITY.md`: the browser is never trusted, credits only from verified ad callbacks, reserve-before-spend, caps at every level, risk scoring with automatic slow-down, freeze and ban, and a kill switch. |
| Ad formats | Native sponsor card while a job runs, a 336×280 / 300×250 rectangle, inline video (16:9, 9:16, 1:1), a result line or 320×50 banner, a side panel that stays up while people work (desktop), a pinned bottom banner (phones), and a Build Pass (a video about every 15 minutes during long builds). |
| Ad rules | Every ad is labeled. Nothing appears inside an answer. Nothing blocks a finished result. **Never reward clicks**: rewards come from opt-in videos only. |
| Video rewards | Credits follow what each video actually paid, so a cheap video never loses money. Several ad networks bid, so prices drop more slowly. |

## Product direction: one place for every AI

Wanlly is a hub, like Higgsfield but for building: chat, code, design, images and video, each using the AI that's best at it.

- **Launch with Claude** (Haiku 5.5, Sonnet 5.5, Opus 5.5, Fable 5.1). Everything else shows as **Coming soon** with a Notify me button that records demand.
- **Next providers:** OpenAI (ChatGPT, Codex, image), Google (Gemini, Imagen, Veo), xAI (Grok), plus specialist image and video models. Images and Video stay Coming soon until one is added, since Claude doesn't generate them.
- **Smart pick:** a tiny Haiku call sorts each request (simple, build, hard, creative) and suggests the cheapest model that will do it well. The person always decides; cheapest is one tap away.
- **Templates:** one-tap recipes (prompt, starter project, model and connections), the "Higgsfield presets" of building.
- **Connections:** GitHub (GitHub App, per repo), Google Workspace (per-file first), Twilio and similar with the person's own encrypted keys; Slack, Notion and M-Pesa Daraja next. Built on MCP where possible.
- **Admin roles:** Owner, Admin, Moderator, Support, Analyst, Ambassador, with every action in an audit log.

## Credits: how people earn

Decided (October 2026): keep it simple for users. **Watch short sponsor videos, earn credits, build.**

- **Every video earns credits:** 4 per 20-second video (following what each video actually pays).
- **First video of the day earns a bonus:** 8 credits, to bring people back daily.
- **Other ways to earn:** short surveys, sponsor trials, referrals, the student bonus.
- **No user-facing pool, no "watch for others", no per-country promises.** Users never need to understand rates by country. Behind the scenes, Wanlly can still top up low-rate regions from revenue already received, under the global safety cap, but that's an internal lever, not a feature.

**How it works today (built):** balances live in the ledger in Neon, never in the browser.
- `POST /api/earn/start` opens a view and returns a one-time id; `POST /api/earn/complete` pays for it only if the same person finishes it after the full video length, within 10 minutes, once. The first paid video of the UTC day gets the 8-credit bonus; every other gets 4.
- Limits: 30 paid videos a day, 4 video starts a minute.
- **Usage limits, the same for everyone:** at most 100 credits spent a day and 500 a week (UTC; weeks start Monday), however many are saved. Shown as Today and This week meters with reset times in the sidebar and on Profile. Tune `DAILY_SPEND_LIMIT` and `WEEKLY_SPEND_LIMIT` in `src/lib/catalog.ts`.
- `POST /api/spend` prices the job from the catalog on the server and takes the credits only if the balance covers it, with a per-person lock so simultaneous jobs can't overspend.
- Surveys, sponsor trials and streaks show as "Soon" until a partner can confirm them server to server.
- When a real ad network is connected, its signed server callback replaces `earn/complete` as the thing that pays.

## Student-friendly advertisers

Students and early-career creators are an audience advertisers want and pay extra to reach. Wanlly sells to them directly once it has numbers.

| Category | Examples of who to approach |
|---|---|
| Learning | Online courses, bootcamps, language apps, exam prep |
| Developer tools | Hosting, databases, design tools, AI and API companies wanting new developers |
| Hardware | Laptops, phones, headphones, student offers |
| Careers | Internship and job boards, freelance marketplaces, remote-work platforms |
| Money and connectivity | Student bank accounts, mobile money, telecom data bundles (often local, strong in Africa and Asia) |

**Formats they buy:** a sponsor card while jobs run, "Today's Sonnet is brought to you by", a sponsor trial (try their tool for credits), sponsored templates, and sponsored weekend challenges and hackathons.

**How it's sold**
1. A one-page **media kit** at `/advertise`: monthly users, countries, share of verified students, top skills people build with, and ad formats with prices.
2. **Verified students:** an optional university-email check. A verified student gets a bonus on their daily allowance, and advertisers pay more to reach verified students.
3. Pricing starts simple: a flat weekly fee per format, or a fixed price per 1,000 views to verified students. Let advertisers buy directly once the dashboard proves the numbers.
4. Each sponsor gets an impact report: "Your campaign funded 3,100 builds by students in 48 countries." Many companies have budgets for exactly this kind of impact.
5. Rules stay the same: every ad labelled, nothing inside answers, no targeting by sensitive data, 18+ only during the beta.

**When:** start conversations at about 2,000 monthly users; close the first deal by about 5,000. Before then, affiliate programmes from developer tools fill the same slots.

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

### Brand ✅ done
Logo set (app icon, mark, wordmark, lockups, light and reversed) as vector SVG in `public/brand/`, the favicon, and the brand guidelines in the Wanlly design system.

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
4. **Limits:** earned balance, 5-hour window, weekly cap, a countdown, and a meter showing what's left on each model.
5. **A global safety cap:** if total AI spend for the day hits your limit, free usage pauses with a clear message. You can never get a surprise bill.
6. **You:** use it every day for a week and note anything that feels wrong.

### Step 4: Ads, first version (Claude builds, you apply)
**With no free tier, people can't use Wanlly until rewarded ads work, so this step gates the beta.**
1. **No free credits, not even a welcome grant.** So a rewarded video partner with server callbacks (AppLixir, see `docs/AD-PARTNERS.md`) must be live before the first beta tester signs in. Until AdSense approves you, fill the display slots with house ads and **self-serve affiliate programs** from developer and student brands.
2. **You:** open publisher accounts with the Stage 1 partners in `docs/AD-PARTNERS.md`: **AppLixir** (rewarded video for web, with signed server callbacks) and one survey offerwall. Google's rewarded web ads come later through Ad Manager.
3. **You:** apply for AdSense once the site has a few real pages (home, about, privacy, terms, a public gallery). Approval can take days to weeks.
4. Consent banner. Ad events logged per user and country, so allowances follow real revenue.
5. **Daily floor:** 8 credits unlocked by one video a day, the same for everyone, tracked on the admin dashboard.
6. Video spots: the server grants credits only after the ad network confirms the view (server-side verification, see `docs/SECURITY.md`).
7. Phones: a pinned bottom banner. Desktop: the side panel.

### Step 5: Images and Design (Claude builds)
1. Images through an image API, saved to R2, with a flat token-based price.
2. Design: the model writes HTML/React, shown in a locked-down preview with version history.

### Step 6: Code and Build Pass (Claude builds, after the beta proves itself)
Launch with Chat and Design first. Design builds single-page sites that run safely in the browser, which already covers most first projects. Code mode comes once people are using Wanlly and ads are paying.

1. **Runs on Claude Managed Agents.** Anthropic runs the agent loop and hosts a private sandbox per session (files, terminal, running code), so we don't build or secure that infrastructure ourselves.
   - Cost: the model's normal token price, plus about **$0.08 per hour** of session running time, plus $10 per 1,000 web searches. Almost all the cost is tokens.
   - Example: a 4–5 hour app build with model mixing is about **KES 300–430**; Sonnet alone, about KES 700–1,050.
   - **Session budgets** put a hard dollar cap on each session. At the cap the agent **pauses and keeps all its work**; raising the cap resumes it. A user's credits become the session's budget.
2. GitHub App install and repo picker. The agent opens a pull request and never pushes to `main`.
3. Haiku does the bulk steps, Sonnet or Opus the hard ones.
4. **Starter templates** (sign-in, database and deploy already set up), so builds don't start from zero.
5. **Cost check before long jobs** (see `docs/architecture.html`): the plan is estimated before anything runs, the person sees the likely cost against their balance, and they choose to top up, go lighter, split it into milestones, or start anyway knowing it will pause safely.
6. **Build Pass:** side panel on and a video about every 15 minutes while long builds run.
7. **"Build overnight" queue:** jobs that can wait run through the batch API at half price.

### Step 7: Launch (mostly you)
1. Privacy policy, terms, contact page.
2. **Invite-only beta first** (a waitlist), so you control cost while the ads ramp up.
3. Open up once ad revenue per user is measured and the limits hold.

### Later
- Direct deals with student-friendly advertisers (see above): media kit at `/advertise`, university-email verification for students, sponsor impact reports.
- Grants and access programmes for under-resourced creators, using the pool's public impact numbers.
- Several video ad networks bidding through Google Ad Manager.
- GPT, Codex and Grok in the model router.
- Plugins over MCP (GitHub, Google Drive, Notion).
- An optional Plus plan.

---

## 4. Getting users (you, starting now)

The product won't promote itself, so start before it's finished.

1. **Build in public from this weekend.** Short posts and screen recordings on X, TikTok, LinkedIn and Instagram: "I'm building a free AI workspace paid for by ads." Show the UI, the ad formats, the economics page.
2. **Waitlist page on your domain** in Step 2, with a "skip the line by inviting friends" link.
3. **Student and creator communities worldwide:** university tech clubs and hackathons, student developer Discords, bootcamps, creator collectives and WhatsApp/Telegram groups, from Nairobi and Lagos to Manila, São Paulo, Dhaka and US community colleges. These are the people Wanlly is built for.
4. **Referral credits:** invite a friend who signs up and both get extra allowance. Cheap to give, and the best growth channel for a free product.
5. **Public gallery** of things people built with Wanlly (with their permission). Good for sharing, search traffic and AdSense approval.
6. **Launch days** when the beta opens: Product Hunt, Hacker News "Show HN", relevant Reddit communities (read each one's rules on self-promotion first).
7. **Small challenges you run yourself:** "Build a tool for your community this weekend", with extra allowance as the prize.

---

## 5. Money

Full model: `docs/ad-economics.html`. All numbers are estimates until real data comes in.

**What a user can earn per day from their own ads** ("Daily use"). Estimates from `docs/ad-economics.html` with the community floor turned off. Africa and South Asia earn a few minutes of Sonnet a day on their own, so the first-video bonus and cheap models (Haiku, Gemini Flash) matter most there.

| Region | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|---|
| Africa | 27 min building / 36 messages | 4 min / 3 | 2 min / 1 | none |
| South Asia | 33 min / 44 | 5 min / 4 | 3 min / 2 | none |
| Southeast Asia | 45 min / 60 | 7 min / 6 | 4 min / 3 | 1 message |
| Latin America | 1h 08m / 90 | 11 min / 9 | 6 min / 4 | 1 message |
| Western Europe | 3h 22m / 269 | 32 min / 26 | 18 min / 13 | 4 messages |
| North America | 4h 45m / 379 | 46 min / 37 | 25 min / 18 | 6 messages |

The Build Pass ad load (side panel on, a video about every 15 minutes) roughly triples these.

**At launch, revenue is close to zero:** ad networks need approval and traffic first, and you have no sponsors yet. So:
- AI cost during the beta comes from your own budget plus any startup credits. **Pick a monthly number you're comfortable losing** ($20–50) and set it as both the Anthropic spend limit and Wanlly's global safety cap.
- There is no welcome grant: the beta opens only once a rewarded video partner is live, so every credit is paid for by an ad.
- Keep the beta invite-only until revenue per user is measured.

**Rules that keep it solvent:**
1. Every token is counted. No model is unlimited.
2. Each person's allowance is the community floor or what their own ads earned, whichever is bigger. The floor is paid only from revenue already received.
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

## Chat (built)

- **Chat and Code are real.** `POST /api/chat` streams a reply as newline-delimited JSON and saves the conversation (`conversations`, `messages`). Recents in the sidebar are real; conversations can be opened and deleted, and are included in data export and account deletion.
- **Models:** Gemini Flash runs now on Google's free tier (the server picks the newest plain Flash model the key can use, hourly; `GEMINI_MODEL` pins one). Claude Haiku, Sonnet, Opus and Fable switch on when `ANTHROPIC_API_KEY` is added in Cloudflare; until then they show "Soon". Sonnet, Opus and Fable send the server-side refusal fallback (`fallbacks: "default"`).
- **Pricing:** each reply takes the model's starting price up front (checked against balance and the daily/weekly limits). Claude replies are then charged their real token cost in credits (one credit = $0.005), never below a zero balance; Gemini stays at its flat price while it's free. A reply that fails before any text arrives is refunded.
- **Limits per reply:** 8,000 output tokens in Chat, 16,000 in Code; about 48,000 characters of earlier conversation are sent with each message. Projects' instructions are added to chats started from a project.
- **Design and Images** are still samples, marked "coming soon", and take no credits.

## Design (built)

- **Design home** (the Design tab): start Slides, a Design, a Design in codebase or a Design System; files are projects with `tool = design` and a `kind`.
- **Editor** at `/design/[id]`: ask on the left, a live preview on the right fills in as the model writes; every result is a saved version (`design_versions`), and changes start from the version on screen. Code view, Download (.html), phone/desktop toggle, full screen, and Present mode for slides (arrows, click, Escape).
- **How it's made:** `POST /api/design/[id]/generate` streams one self-contained HTML page per version (prompts per kind in `src/lib/design.ts`), same pricing as chat at the Design price (2 x the model's credits), refunded if no usable page arrives.
- **Safety:** previews run in an iframe with `sandbox="allow-scripts"` (no same-origin), plus a content security policy that blocks network requests, form submissions and every outside file except Tailwind and Google Fonts (`src/lib/design-preview.ts`). Designs are never opened on Wanlly's own origin.
- **Long pages:** designs get up to 32,000 output tokens, and a page that still comes back unfinished is continued automatically (up to two more times) before it's saved.
- **Live editing:** Edit turns the preview into an editable page (click any text and type); Save stores the edited body as a new, free version with the original <head> untouched.
- **Exports:** PowerPoint built in the browser from the slides as rendered (shapes and real text boxes, PptxGenJS 3.12.0 from jsDelivr with an integrity hash); PDF through the preview's print (one 16:9 slide per page); Google Drive (slides become Google Slides via the .pptx; other designs upload as .html) using the person's own Google access with the `drive.file` scope, requested through Clerk the first time; HTML download.
- **Google Drive setup (once):** in Clerk, Google needs custom credentials from a Google Cloud OAuth client with the Google Drive API enabled and the `https://www.googleapis.com/auth/drive.file` scope allowed.
- **Design systems:** any design can be built on one of the person's Design System files (picker next to the model); its styles go to the model with the request. Design systems export CSS variables, a Tailwind v4 theme and W3C design tokens (JSON).
- **Codebase:** Design in codebase and Design export a React component (.jsx), also shown in Code view as HTML or React.
- **Phones:** the editor shows Preview and Ask as tabs below 1024 px.
- **Attachments:** images (placed in the page), PDFs and text files can be dropped, pasted or picked.
- **Not yet:** connecting a real repository for Design in codebase, and sharing.
