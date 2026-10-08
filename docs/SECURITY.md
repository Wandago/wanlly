# Wanlly anti-abuse architecture

Wanlly gives out access to paid AI models in exchange for ad views. That makes it a target for three kinds of abuse: **stealing AI** (using more than you earned, or reselling access), **faking ad views** (bots or scripts farming credits), and **misusing the models** (content that breaks provider rules). Any of them can cost real money or get the Anthropic or ad accounts shut down.

No system is impossible to bypass. The goal is that **abuse costs the abuser more than it's worth**, is **spotted within minutes**, and **can never cost more than the daily safety cap.** Every layer below assumes the one before it can fail.

## The guarantee: losses are always capped

"Airtight" here means **the worst case is a known, small number**, not that nobody ever tries.

| Level | Hard limit | Who sets it |
|---|---|---|
| One request | `max_tokens` and a task budget; cost reserved before the call | The model router |
| One account, one day | Its own earned credits plus the community floor | The ledger |
| The community pool | Only money already received; per-country share capped | The daily pool job |
| All of Wanlly, one day | The global safety cap, which pauses AI before it's exceeded | You, in the admin page |
| The Anthropic account | The Console spend limit, the last backstop | You, in the Anthropic Console |

**What a fake account is worth:** the floor is a few US cents a day and can't be saved up. Getting it needs a real phone number (virtual numbers are blocked), a device we haven't seen, a passed bot check and a watched video every day. A SIM card costs more than weeks of that floor, so farming accounts loses money.

---

## 1. The rules that make bypassing pointless

These are structural, so no clever client-side trick gets around them.

1. **The browser is never trusted.** It never sees an API key, never decides a price, never adds credits. Everything that touches money happens on the server.
2. **Credits only come from verified events.** An ad network's server-side callback for a completed rewarded view, or an admin grant. Nothing else creates credits.
3. **Reserve before spending, settle after.** Before any model call, the server reserves the most that call could cost (`max_tokens` × output price + input × input price). If the balance can't cover it, the call never starts. When the stream ends, the real cost from the API's `usage` report is charged and the rest is released.
4. **The ledger is append-only.** Balances are the sum of ledger entries. Entries are never edited or deleted, only reversed by new entries, so every credit can be traced to where it came from.
5. **Hard caps at every level:** per request (`max_tokens`, task budget for agents), per 5-hour window, per day, per week, per account, and a **global daily spend cap** that pauses all usage before it can exceed what you set. The Anthropic Console spend limit is the last backstop.

## 2. Sign-up: one real person, one account

| Check | Tool | Free? |
|---|---|---|
| Bot challenge on sign-up and on earning | **Cloudflare Turnstile** (invisible CAPTCHA) | Yes |
| Verified email, Google or GitHub sign-in | Clerk | Yes |
| Phone number verification before the first credits | Clerk phone OTP | Check Clerk's current pricing for SMS |
| Block disposable email domains | Clerk setting + a blocklist | Yes |
| Device fingerprint at sign-up and sign-in | Open-source FingerprintJS, stored hashed | Yes |
| Country from the network, compared with the phone's country | Cloudflare's `CF-IPCountry` header | Yes |
| Block sign-ups from data-centre IPs and known proxy ranges | Cloudflare (ASN data), a blocklist | Yes |

New accounts start with **zero credits.** The first credits come from watching a rewarded video, which is itself a bot check.

## 3. Earning: making fake ad views worthless

- **Server-side verification (SSV):** rewarded ad networks call our server directly with a signed message when a view completes. We check the signature, that the transaction ID is new, that it matches a view we started for that user in the last few minutes, and that the reward matches what we offered. Only then do credits appear.
- **Partners without a server callback** (Google's rewarded ads for web have none; that feature is app-only): a single-use view ticket from our server before the ad starts, checks on watch time, caps and risk score when the page reports the reward, then **provisional credits** reconciled against the network's reports and reversed on mismatch. Flagged users only get partners with server callbacks. See `docs/AD-PARTNERS.md`.
- **Rewards follow real payout:** credits per view are set from what that view actually paid. A fraudulent view that the network later refuses to pay for gets its credits reversed.
- **Earning caps:** at most N videos per hour and per day per account, device and IP. A minimum gap between views.
- **No bots get ads:** suspected bots are never shown ads. That protects the AdSense / Ad Manager account from invalid-traffic bans, which would cut off all revenue.
- **Never pay for clicks.** Rewards are for opt-in video views only; incentivized clicks break every ad network's rules.

## 3b. Every model, for everyone, from day one

There are no account-age levels. A new account can use Haiku, Sonnet, Opus, Fable, Code mode and coworkers on its first day, as long as it has the credits. What keeps that safe:

- **Credits are the limit.** Every credit was paid for by an ad or the pool, so a new account can only spend what was already earned. An Opus or Fable request reserves its full possible cost first; if the balance can't cover it, it doesn't start.
- **Per-request and per-session caps** on every model, and one active Code session per account.
- **Risk, not age, decides restrictions.** An account the risk scorer flags (see section 5) is slowed, challenged or frozen, whether it's one day or one year old.
- **Payout holds stay where money comes from outside:** survey credits wait for the survey company to confirm; referral rewards wait for the friend to be real. These hold credits, not models.

## 3c. Every way credits can be created, and its guard

Credits can only come from the sources below. Each one has its own check, and **every credit source has a daily cap per account.**

| Source | Main risk | Guard |
|---|---|---|
| Rewarded video with a server callback (AppLixir and others) | Fake or replayed views | Signature check, new transaction ID, matches a view we started, reward matches the offer |
| Rewarded video without a callback (Google's web rewarded ads) | Faked "reward granted" event in the browser | Single-use view ticket, realistic watch time, caps, **provisional credits** reconciled with the network's reports and reversed on mismatch; never offered to flagged accounts |
| Offerwalls and surveys | Fake sign-ups, offer fraud | Verified accounts only; credits **held until the offer network's pending period clears**; their reversals reverse our credits; daily cap |
| Community floor | Account farming | One per verified person (phone, device, bot check); unlocked by a video each day; the same amount for everyone; can't be saved up; virtual numbers blocked |
| Referrals | Inviting your own fake accounts | Paid only when the invitee is verified and has watched videos on 3 different days; no reward when they share a device, network or phone range; monthly cap per referrer |
| Student bonus | Fake university emails | Known university domain list, disposable domains blocked, one bonus per address, re-checked every year; small bonus |
| Admin grants | A compromised or careless admin | Logged with a reason; above a set amount needs a second admin |

## 4. Spending: stopping overuse and reselling

- **Rate limits** per user, device and IP on every API route (Cloudflare rate limiting), stricter for expensive models.
- **One active session per account** for long builds; a second device signing in pauses the first.
- **Request shape limits:** maximum prompt size, maximum attachment size, maximum agent steps, and a task budget on every agent run.
- **No raw API access.** Wanlly never exposes an OpenAI-style endpoint. Everything goes through the UI, so it can't be plugged into other tools as a free API.
- **The API key lives only on the server**, in Cloudflare secrets, with a separate key per environment and a spend limit on each.
- **Bound sessions:** each sign-in session is tied to its device. A token copied to another machine or script stops working, and bot checks repeat silently during long sessions.
- **Ads only count when someone can see them:** an ad view counts only while the tab is visible and the ad is on screen. Background tabs and hidden windows earn nothing, which also protects the ad accounts from invalid-traffic bans.

## 5. Detection: seeing abuse as it happens

Every request and every ad event writes a row with user, device hash, IP prefix, country, model, tokens, cost and timing. A scheduled job (every 5 minutes) scores each account. Signals:

| Signal | What it suggests |
|---|---|
| Many accounts on one device, IP or payment-free phone range | Account farming |
| Credits earned faster than a human could watch videos | Ad fraud or replayed callbacks |
| Video completion patterns that are too regular (same seconds, same intervals) | Scripted viewing |
| Country from the network ≠ phone country ≠ ad payout country | VPN reward arbitrage |
| Usage at all hours with no idle time | Shared or resold account |
| Many near-identical prompts, or prompts that look like another app's requests | Reselling through Wanlly |
| Spend jumps far above that account's normal | Stolen session or new abuse |
| Many refusals or safety-flagged requests | Model misuse |

Each signal adds to a **risk score**. Actions by score:

1. **Watch:** logged, nothing changes.
2. **Slow down:** lower rate limits and earning caps.
3. **Challenge:** Turnstile again, then phone re-verification.
4. **Freeze:** spending and earning paused, pending review. Recent earned credits held.
5. **Ban:** account, device and phone blocked. Credits from fraudulent views reversed.

You get an alert (email or Slack) for every freeze, and an **admin page** that shows the riskiest accounts, global spend today vs the cap, earnings vs spend by country, and a one-click **kill switch** per model and for the whole app.

## 5b. Code mode, connections and agents

Agents run code and act on connected accounts, so they get their own rules.

- **No free compute:** each session has a dollar budget, a maximum running time, and limits on CPU-heavy work. Crypto mining, scanning the internet, mass scraping and hosting public services are banned and watched for.
- **Limited network access:** the sandbox reaches only what builds need (package registries, the user's GitHub repo). Check Managed Agents' current networking options when building Step 6.
- **Prompt injection:** files, repos and documents can contain hidden instructions. The agent never has our secrets, holds only the permissions the user granted, and **asks before any action outside the sandbox**: opening a pull request, sending a Twilio SMS, editing a Google Doc.
- **Least privilege:** the GitHub App gets the chosen repos only, Google gets per-file access, and user keys (Twilio and similar) are encrypted and used only for the action the user started.

## 5c. Accounts and admins

- Sign-in with Google, GitHub or passkeys; email alert on a new device; a session list where people can sign out everywhere.
- **Admins:** two-factor sign-in required, roles with least privilege, every action in the audit log, and big credit grants or unbans need a second admin.
- **Our own bugs are a risk too:** a nightly job checks that every balance equals the sum of its ledger entries, and an alert fires if AI spend in any hour is more than 3× the usual rate. Above 5×, the most expensive models pause automatically until you look.
- GitHub secret scanning on the repo, so a leaked key is caught at once.

## 6. Model misuse

- Anthropic's usage policies apply to everything users send through Wanlly, and Wanlly is responsible for its users.
- Handle `refusal` stop reasons properly and count them per account; repeated refusals raise the risk score.
- A short system prompt that states Wanlly's own rules; no way for users to change it.
- Terms of service that forbid reselling, scraping, automated use and policy violations, with the right to ban.
- Keep request logs for a fixed, stated period so abuse reports can be investigated, and say so in the privacy policy.

## 7. Basics that must not be skipped

- Secrets only in environment variables; never in the repo, never in chat.
- Every database query scoped to the signed-in user on the server.
- Webhooks (Clerk, ad networks) verified by signature, and rejected if replayed.
- Code mode runs in an isolated sandbox with no access to our secrets or network beyond what the job needs. The agent opens pull requests, never pushes to `main`.
- Design previews run in a sandboxed iframe with no network.
- Dependencies kept updated; Sentry alerts on errors; a monthly review of the abuse dashboard.

## Testing it before people do

Before the beta opens, and again before each new credit source goes live:

1. **Try to break it yourself** with a checklist: replay an ad callback, fake a reward event in the browser, run two devices on one account, sign up with a virtual number, invite your own second account, send a request with a huge prompt, and copy a session token to another machine. Each must fail and show up on the Abuse page.
2. **Load test** the reserve-and-settle logic with many requests at once, so the balance can never go below zero.
3. **Kill-switch drill:** pause a model and the whole app from the admin page and check it takes effect within a minute.
4. **Reward people who report holes:** a security contact on the site and credits for valid reports.

## When something goes wrong

1. **Contain:** use the kill switch or freeze the accounts involved. Losses stop at once.
2. **Check:** the ledger and request logs show what happened and to whom.
3. **Reverse:** fraudulent credits are reversed with new ledger entries; real users are restored.
4. **Fix and learn:** patch the hole, add the case to the testing checklist, and tell affected users if their data was involved (within 72 hours to regulators where required; see `docs/LEGAL.md`).

## Build order

This lands alongside the plan's steps, not after them:

| Plan step | Security work in the same step |
|---|---|
| Step 2: sign-in and database | Turnstile, verified sign-in, device hash, country, append-only ledger, per-user query scoping |
| Step 3: real chat with limits | Reserve-and-settle, all caps, global safety cap, rate limits, request logging, refusal handling |
| Step 4: ads | Server-side verification of rewarded views, view tickets and provisional credits for partners without callbacks, earning caps, visible-only ad counting, no ads for suspected bots, community floor rules, referral rules |
| Before the beta opens | Risk scoring job, alerts, admin page and kill switch, ledger check and spend-spike breaker, admin two-factor, the break-it checklist, terms and privacy policy |
| Offerwalls and student bonus | Pending-period holds and reversals, university domain list |
| Step 6: Code mode | Session budgets from the user's credits, time limits, limited network access, approval before outside actions, one active session per account |

## Tools, by job

| Job | Tool | Cost |
|---|---|---|
| Bot check on sign-up, sign-in and earning | **Cloudflare Turnstile** | Free |
| Block bad traffic at the edge | **Cloudflare WAF and Bot Fight Mode**, rate-limiting rules | Free tier |
| Bot detection in sign-in | **Clerk** bot protection and disposable-email blocking | Free tier |
| Device fingerprint | **FingerprintJS** open-source library (upgrade to Fingerprint Pro if abuse grows) | Free, then paid |
| VPN, proxy and data-centre IP detection | Cloudflare's network data first; **IPinfo** or **IPQualityScore** free tiers for extra checks | Free tiers |
| Phone verification | **Clerk** phone codes, or **Twilio Verify** | Per message |
| Block virtual and VoIP numbers | **Twilio Lookup** line type check | Per lookup |
| University emails | A public list of university domains, kept up to date | Free |
| Verified ad views | The ad network's **server-side verification** callbacks | Free |
| Invalid ad traffic | Google Ad Manager's built-in invalid-traffic filtering; never show ads to flagged accounts | Free |
| Harmful prompts | Provider safety (Claude declines harmful requests and reports a refusal); a cheap Haiku check on flagged accounts | Pennies |
| Errors and attacks | **Sentry** alerts | Free tier |
| Session evidence for abuse reviews | **PostHog** session recordings with personal data masked | Free tier |
| Risk scoring, alerts, kill switches | Our own job every 5 minutes plus the admin Abuse page | Free |
