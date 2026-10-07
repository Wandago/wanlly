# Wanlly build plan

Wanlly is a free, ad-supported AI workspace with four tools (Chat, Code, Design, Images), one shared composer, and credits that people earn from opt-in sponsor spots. The UI reference is `prototype/index.html`.

## 1. What "free to set up" means

Everything below runs on free tiers **except model usage**. Every model call costs money, so you need a small budget from day one.

| Need | Free option | Watch out for |
|---|---|---|
| Hosting (web + API) | **Cloudflare Workers + Pages**, free plan | Vercel's free Hobby plan doesn't allow commercial use. Once ads go live, that means you. |
| Database, auth, file storage | **Supabase**, free plan | Free projects pause after about a week with no traffic. Fine while building. |
| Rate limiting, counters | **Upstash Redis**, free tier | Daily command cap |
| Scheduled jobs (daily credit reset) | Cloudflare Cron Triggers | Free |
| GitHub access for Code mode | **GitHub App** | Free |
| Product analytics | PostHog, free tier | |
| Error tracking | Sentry, free tier | |
| Email (sign-in links) | Resend, free tier, or Supabase's built-in email | Built-in email has low send limits |
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
- **Data:** Supabase Postgres with Row Level Security on every table.
- **Models:** each provider's official SDK (`@anthropic-ai/sdk`, `openai`, xAI) behind one small `providers/` router of our own.
- **Images:** an image-generation API. Claude doesn't make images, so pick one of OpenAI's image models, Google's Imagen, or Flux via Cloudflare Workers AI. Workers AI has a free daily allowance.
- **Code sandbox:** decided in Phase 7 (E2B, Cloudflare Sandbox, or Claude Managed Agents). This is the one tool that needs real compute.

## 3. Step by step

Each phase ends with something you can click on.

### Phase 0: Accounts (one afternoon)
1. Create accounts: Cloudflare, Supabase, Upstash, Anthropic Console, PostHog, Sentry.
2. Set the Anthropic spend limit and create an API key. Store it only in Cloudflare secrets and `.env.local`, never in the repo.
3. Register a **GitHub App** named "Wanlly" with these permissions: Contents (read/write), Pull requests (read/write), Metadata (read).
4. Create Google and GitHub OAuth apps for sign-in and connect them in Supabase Auth.

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
1. Supabase auth: Google, GitHub, and email sign-in links.
2. Tables: `profiles`, `conversations`, `messages`, `jobs`, `ledger_entries`, `ad_events`, `github_installations`.
3. RLS policies so users only ever read their own rows.

### Phase 3: Chat (first real model call)
1. A `/api/chat` route that streams from the provider router. Default model is Haiku 5.5, and Sonnet 5.5 is unlocked with credits.
2. **Prompt caching** on the system prompt and conversation history, which cuts repeat input cost about 10x.
3. Charge credits from the **actual token usage** the API reports when the stream ends, not from an estimate. Refund on errors.
4. Rate limits per user and per IP (Upstash).

### Phase 4: Credits and ads
1. **The ledger is the source of truth:** credits = sum of `ledger_entries`. Never store a balance the browser can edit.
2. Daily free allowance through a cron job.
3. Ad slots behind one interface with swappable sources:
   - **Start:** house ads (your own promos) and **affiliate deals** with developer tools. These need no approval.
   - **Then:** Google AdSense / Ad Manager (display + rewarded) once the site has real content and a domain.
4. **The server grants rewards, never the browser.** Credits are only added after the ad network's server confirms the view. Add per-day caps and cooldowns.
5. Consent banner before any ad loads.

### Phase 5: Images
1. A `/api/images` route that calls the chosen image API and saves results to Supabase Storage.
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

## 4. Rules to keep from day one

- Sponsors never appear inside a model's answer and never change it.
- Every ad is labeled and optional. Nobody is blocked after a result is ready.
- Use official provider APIs only. No proxying consumer subscriptions like Copilot or ChatGPT Plus.
- Secrets live in environment variables, never in the repo.
