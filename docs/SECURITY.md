# Wanlly anti-abuse architecture

Wanlly gives out access to paid AI models in exchange for ad views. That makes it a target for three kinds of abuse: **stealing AI** (using more than you earned, or reselling access), **faking ad views** (bots or scripts farming credits), and **misusing the models** (content that breaks provider rules). Any of them can cost real money or get the Anthropic or ad accounts shut down.

No system is impossible to bypass. The goal is that **abuse costs the abuser more than it's worth**, is **spotted within minutes**, and **can never cost more than the daily safety cap.** Every layer below assumes the one before it can fail.

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
- **Rewards follow real payout:** credits per view are set from what that view actually paid. A fraudulent view that the network later refuses to pay for gets its credits reversed.
- **Earning caps:** at most N videos per hour and per day per account, device and IP. A minimum gap between views.
- **No bots get ads:** suspected bots are never shown ads. That protects the AdSense / Ad Manager account from invalid-traffic bans, which would cut off all revenue.
- **Never pay for clicks.** Rewards are for opt-in video views only; incentivized clicks break every ad network's rules.

## 4. Spending: stopping overuse and reselling

- **Rate limits** per user, device and IP on every API route (Cloudflare rate limiting), stricter for expensive models.
- **One active session per account** for long builds; a second device signing in pauses the first.
- **Request shape limits:** maximum prompt size, maximum attachment size, maximum agent steps, and a task budget on every agent run.
- **No raw API access.** Wanlly never exposes an OpenAI-style endpoint. Everything goes through the UI, so it can't be plugged into other tools as a free API.
- **The API key lives only on the server**, in Cloudflare secrets, with a separate key per environment and a spend limit on each.

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

## Build order

This lands alongside the plan's steps, not after them:

| Plan step | Security work in the same step |
|---|---|
| Step 2: sign-in and database | Turnstile, verified sign-in, device hash, country, append-only ledger, per-user query scoping |
| Step 3: real chat with limits | Reserve-and-settle, all caps, global safety cap, rate limits, request logging, refusal handling |
| Step 4: ads | Server-side verification of rewarded views, earning caps, no ads for suspected bots |
| Before the beta opens | Risk scoring job, alerts, admin page and kill switch, terms and privacy policy |
| Step 6: Code mode | Sandbox isolation, task budgets, one active session per account |
