# Cadre architecture

Cadre is a Wanlly product: a team of AI agents that keeps a Kenyan shop running.

- **The web app is the control console.** The owner signs up, connects M-Pesa, the bank and email, chooses which agents are on and sets the approval rules. It also shows connection health and an activity log. It is not a dashboard anyone needs to check daily.
- **WhatsApp is where everything else happens.** Cadre texts the owner their reports, payment and finance updates as soon as it gets hold of them, and every approval. The owner replies with a tap or a few words.

The look and feel mockups (console, WhatsApp, setup) are on the "Cadre look and feel" design canvas. They use the Wanlly design system's dark theme: ink surfaces, tangerine as the single signal colour, Bricolage Grotesque, Geist and Geist Mono.

## 1. Who it's for and what v1 does

**Customer:** any shop in Kenya (hardware, retail, salon, pharmacy, wholesale, and so on) that gets paid by M-Pesa through a **Paybill**, a **Till**, a **personal number** or **Pochi la Biashara**, often several at once.

**v1 promise:** "Every shilling that comes in is logged and matched, you know who owes you, and you get one useful message each morning."

| In v1 | Later |
|---|---|
| Chief (coordinator), Finance, Inbox | Operations, People, Marketing, Legal |
| M-Pesa: SMS forwarding, statement upload, Daraja (C2B alerts, STK Push) | Daraja B2C payouts, Equity Jenga, eTIMS |
| Email forwarding (bank alerts, supplier invoices) | Direct Gmail and Outlook connections |
| WhatsApp with the owner on Cadre's own number | Messaging the shop's customers from the shop's own WhatsApp number |

Everything below is designed for all seven agents, so adding one later is configuration, not a rewrite.

## 2. Rules first, AI where it's needed

Most of what Cadre does is arithmetic and bookkeeping, which code does better, more cheaply and more safely than a model. AI is used only where language or judgement is involved.

| Task | How | Uses AI |
|---|---|---|
| Reading M-Pesa SMS and statements | Versioned patterns for each message format | No (AI only as a flagged fallback) |
| Matching payments to customers and debts | Rules on phone number, name and amount | No |
| Morning brief, finance reports, alerts | Templates filled with real numbers | No |
| Approvals ("1", "Send all") | WhatsApp buttons and numbered menus | No |
| Overdue debts, KRA deadlines, low stock | Scheduled checks | No |
| Free-text questions ("Nani ananidai?", "How was last week?") | Model picks a known query; code runs it and formats the answer | Yes, small |
| Voice notes | Speech to text, then as above | Yes |
| Drafting emails and messages, summarising documents | Model | Yes |

**Numbers in a message always come from the database, never from a model.** A model may choose which query to run or how to phrase the result, but it never does the sums.

### The model router

One small `models/` module decides where each AI task goes, in this order:

1. **No model**, if a rule or pattern can handle it.
2. **Cloudflare Workers AI** (free daily allowance): open models for classifying and short answers, and Whisper for voice notes.
3. **Claude** (Haiku 5.5 for simple tasks, Sonnet 5.5 for judgement), once startup credits or paying shops cover it.

Each shop has a daily AI budget. When it runs out, Cadre falls back to the rules-only path, which still delivers the brief and alerts.

**Free tiers that may use data to train models (for example some free API tiers) are for development only**, never for shops' financial data, because of Kenya's Data Protection Act.

## 3. System overview

```
                 ┌──────────── Console (Next.js web app) ────────────┐
 Owner (browser) │ setup · connections · rules · cadre · activity    │
                 └──────────────────────────┬─────────────────────────┘
                                            │
 Owner (WhatsApp) ── Meta Cloud API ──┐     │
 Safaricom Daraja ── callbacks ───────┤     │
 Forwarded email ─── Email Routing ───┤     ▼
 Statement upload ─────────────────── ┴─► Edge API (Cloudflare Workers)
                                            │  verify · normalise · dedupe
                                            ▼
                                     events table + Queue
                                            │
                     ┌──────────────────────┼──────────────────────┐
                     ▼                      ▼                      ▼
                Specialists  ──signals──►  Chief  ──messages──►  Channel service
         (Finance, Inbox, ...)      (prioritise, budget,       (WhatsApp templates,
                     │               brief, route)               buttons, replies)
                     │ proposals
                     ▼
               Action engine ── policy ──► auto-run │ ask owner ──► approval
                     │                                        │
                     ▼                                        ▼
                 Executors (Daraja, email, ...)  ◄────── approved
                     │
                     ▼
                 audit_log (append-only)
```

### The pieces

| Piece | Job | Runs on |
|---|---|---|
| **Console** | Sign-up, connecting money and email, which agents are on, approval rules, message schedule, connection health, activity log | Next.js on Cloudflare (OpenNext), same stack as Wanlly |
| **Edge API** | Receives webhooks (Meta, Daraja) and forwarded email, verifies them, turns them into normalised **events**, stores them once | Cloudflare Workers, Email Workers |
| **Event bus** | Every event is a row in `events` plus a Queue message, so nothing is lost and anything can be replayed | Neon Postgres + Cloudflare Queues |
| **Agent runtime** | Each specialist is a module with its own rules, tools and prompts. It reads events and data, and writes **signals** (things worth knowing) and **proposals** (things worth doing). | Workers + model router |
| **Chief** | Ranks signals, keeps to the owner's attention budget, assembles the morning brief, routes owner replies to the right specialist | Workers + model router |
| **Action engine** | Applies the owner's rules to each proposal: run it, or ask first. Waits for approval, then runs it exactly once. | Cloudflare Workflows (durable steps, retries, wait-for-event) |
| **Executors** | The only code that touches the outside world: Daraja STK Push, sending email, and later B2C payouts | Separate Workers with their own secrets |
| **Channel service** | Sends WhatsApp messages (templates outside the 24-hour window, buttons inside it), parses replies, handles forwarded SMS | Workers |
| **Scheduler** | Morning brief, overdue checks, deadline reminders, statement reconciliation | Cloudflare Cron Triggers |

### Stack (shared with Wanlly where possible)

- **App:** Next.js + TypeScript on Cloudflare, Tailwind with the Wanlly tokens.
- **Data:** Neon Postgres + Drizzle, with row-level security (section 7).
- **Auth:** Clerk with **Organizations** (a shop is an org; owner, manager and viewer roles).
- **Files:** Cloudflare R2 for statements, invoices and contracts.
- **Email in:** Cloudflare Email Routing to an Email Worker. Each shop gets its own address to forward bank alerts and invoices to.
- **Durable work:** Cloudflare Queues, Workflows and Cron.
- **Models:** the router in section 2.

## 4. Two flows, end to end

### A payment comes in (Till, via Daraja)

1. Safaricom calls our C2B confirmation URL. The Edge API checks the secret in the URL and the source IP, then stores a `payment.received` event keyed by the M-Pesa code. A repeat is ignored.
2. Finance turns it into a `transactions` row, matches the payer's phone and amount to an open invoice or customer, and marks the invoice paid if it matches exactly.
3. If it's an ordinary sale, Finance just logs it, and it shows in tomorrow's brief. If it's large, or it settles an overdue debt, Finance raises a signal.
4. The Chief decides whether the signal is worth a ping today (attention budget) or should wait for the brief.

A forwarded SMS follows the same path from step 2. Its source is `sms_forward` instead of `daraja`, and its trust level is "self-reported" until a statement or Daraja confirms it.

### Asking customers to pay (needs approval)

1. Each morning, Finance proposes "Send STK Push to 3 overdue customers, KES 128,500".
2. The action engine looks up the rule for `collect.stk_push`. The default is "ask me", so it creates an `approvals` row and the Chief includes it in the brief, with buttons.
3. The owner taps **Send all**. The button reply carries the approval ID, so there's no guessing what "1" meant. The engine checks that the reply came from a verified member phone and that the approval hasn't expired.
4. The Workflow resumes, the Daraja executor sends the three STK Pushes with idempotency keys, and the results come back as events.
5. Each step is written to `audit_log`.

## 5. The agents

Each agent has **read tools**, **proposal types** it may raise, and **nothing else**. Agents never hold credentials and never call executors directly.

| Agent | Reads | Can propose | When |
|---|---|---|---|
| **Chief** | All signals, the owner's replies | Messages to the owner, routing | v1 |
| **Finance** | Transactions, invoices, customers, statements | Match or mark paid, invoice, reminder, STK Push request | v1 |
| **Inbox** | Emails forwarded to the shop's Cadre address | File, draft a reply, turn a bank alert into a transaction | v1 |
| **Operations** | Sales by item, stock counts, suppliers | Restock order (email to supplier), price alerts | Later |
| **People** | Staff, attendance, payroll settings | Payroll run (B2C), statutory deductions, leave | Later |
| **Marketing** | Customers, sales trends | Promo drafts, WhatsApp broadcast to opted-in customers | Later |
| **Legal** | Contracts, leases, licences | Renewal reminders, contract summaries (never legal advice) | Later |

**Shared workflows (playbooks)** are versioned JSON: a trigger, then steps that may belong to different agents. For example: "Payment received → Finance matches → receipt sent to customer → Operations updates stock". Playbooks are stored per shop, so a shop can turn one on or off without code.

**Language:** owners will write in English, Swahili and Sheng. Menus and buttons work in any language. Free text and voice notes go through the model router.

## 6. Kenyan money integrations

| Source | How | Gives us | Trust |
|---|---|---|---|
| **Paybill / Till** | Daraja: C2B register URL (alerts), STK Push, Transaction Status, Account Balance; Pull Transactions where Safaricom grants it | Real-time payments, payment prompts | Verified |
| **Personal number / Pochi** | Owner forwards the M-Pesa SMS to Cadre on WhatsApp | Payments as they happen, if forwarded | Self-reported |
| **Any M-Pesa account** | Statement upload (PDF, usually password-protected) | Full history; backfill and reconciliation | Verified |
| **Equity Bank** | Jenga API | Balance, statements | Verified |
| **Any bank** | Owner auto-forwards bank alert emails to the shop's Cadre address | Near-real-time bank movements | Self-reported |
| **Payouts** (later) | Daraja B2C | Salaries, suppliers, refunds | Executor only |

Rules for money data:

- **The M-Pesa transaction code is the key.** It's unique per transaction, so `(org_id, source_ref)` is unique and any repeat (two forwards, a forward and then the statement) merges instead of double-counting.
- **Amounts are integers in cents** (`bigint`), never floats.
- **The SMS parser is deterministic first:** versioned patterns for each M-Pesa message type (received, paid to Till, sent, withdrawal, Fuliza, reversal). A model is the fallback, with a strict output schema, and every row parsed that way is flagged for review.
- **Daraja go-live is per shortcode** and needs Safaricom's approval. Onboarding shows the owner where they are in that process, and Cadre works on SMS forwarding and statements until approval comes through.

## 7. Database

Postgres on Neon. Every business table has `org_id`, and **row-level security** limits each query to the org set for the current transaction (`set_config('app.org_id', …)`). Server code also scopes by org, so a mistake in one layer is caught by the other.

| Table | What it holds | Key columns |
|---|---|---|
| `orgs` | A shop | clerk_org_id, name, town, timezone, plan, daily AI budget, inbound email address |
| `members` | People in a shop | clerk_user_id, role (owner, manager, viewer), whatsapp_phone, phone_verified_at, pin_hash |
| `integrations` | Each connection | kind (daraja_paybill, daraja_till, sms_forward, statement, email_forward, jenga), status, config, last_event_at, `credential_ref` |
| `credentials` | Encrypted secrets | ciphertext, wrapped_dek, key_version, scope. Never selected by agent code. |
| `events` | Everything that happened | type, source, source_ref (unique per org), payload, received_at, processed_at |
| `transactions` | Unified money ledger | direction, amount_cents, currency, counterparty_id, channel, source, source_ref, trust, occurred_at |
| `counterparties` | Customers and suppliers | name, phones (hashed and encrypted), kind, notes |
| `invoices` | What's owed | counterparty_id, amount_cents, due_on, status, paid_by_txn |
| `signals` | Things worth knowing | agent, kind, priority, summary, data, delivered_in (brief or ping), seen_at |
| `proposals` | Things worth doing | agent, action_type, params, risk_tier, status, idempotency_key |
| `approvals` | A question to the owner | proposal_id, asked_via, expires_at, decided_by, decision, decided_at, step_up_used |
| `rules` | What may run without asking | action_type, mode (auto, ask, never), limits (per action, per day) |
| `agent_settings` | Which agents are on | agent, enabled, settings (for example brief time) |
| `playbooks` / `playbook_runs` | Shared workflows | definition (versioned JSON), enabled; run state |
| `messages` | WhatsApp in and out | direction, wa_message_id (unique), template, body, related approval or signal |
| `agent_runs` | Every model call | agent, provider, model, input and output tokens, cost, latency, outcome |
| `documents` | Files in R2 | kind (statement, invoice, contract), r2_key, parsed_at |
| `deadlines` | KRA and other dates | kind (PAYE, VAT, SHIF, NSSF, Housing Levy, lease), due_on, status |
| `audit_log` | Append-only record | actor (member, agent, system), action, target, data, prev_hash, hash |

`audit_log` is hash-chained per shop (each row stores the previous row's hash), so any edit or deletion shows up. The app's database role can only insert into it and read it.

## 8. Security model

**Principle: the AI suggests, policy decides, the owner approves, and narrow executors act.**

### Risk tiers

| Tier | Examples | Default |
|---|---|---|
| **0 · Read** | Log a payment, summarise, sort email, raise a signal | Automatic, logged |
| **1 · Internal change** | Match a payment to an invoice, tag a customer, draft a reply | Automatic, logged, can be undone |
| **2 · Speaks for the shop** | Receipt or reminder to a customer, STK Push request, email to a supplier | Ask. The owner may allow specific types to run automatically. |
| **3 · Moves money or commits the shop** | B2C payout, payroll, signing or terminating anything | **Always ask, plus step-up** (PIN or passkey on a one-time link), plus per-action and daily limits. Can't be set to automatic. |

The tier belongs to the **action type** in code, not to what the model says. A prompt can't lower it.

### Identity and approvals

- Owner and managers sign in to the console with Clerk. Their WhatsApp number is verified once with a code sent from Cadre.
- An approval on WhatsApp is accepted only from a verified member number, only while it hasn't expired (24 hours by default), and only once.
- Buttons carry the approval ID. Typed replies like "1" only count against the menu Cadre sent most recently.
- **Tier 3 never completes from a WhatsApp reply alone.** SIM-swap fraud is common in Kenya, so payouts need a step-up on a one-time link (Clerk session plus a Cadre PIN or passkey). The PIN is never typed into the chat.

### Credentials

- Daraja keys, passkeys, B2C initiator credentials and OAuth tokens use **envelope encryption**: a key per shop, wrapped by a master key held in Cloudflare secrets, with key versions so keys can be rotated.
- Only executors can decrypt. The B2C executor is its own Worker with its own secret, callable only by the action engine with an approved, unexpired, step-up-verified proposal.
- Agent code and prompts never see credentials.

### Webhooks and inbound email

- **Meta:** verify `X-Hub-Signature-256` on every request.
- **Daraja:** callbacks aren't signed. Each shortcode gets its own unguessable callback path, we accept only Safaricom's published IP ranges, and anything above a threshold is confirmed with a Transaction Status query before anyone relies on it.
- **Inbound email:** accept mail only for addresses that belong to a shop, record the SPF and DKIM results, and treat bank alerts from unverified senders as "needs a look" rather than as money.
- Every webhook is idempotent on its external ID.

### Prompt injection

Emails, forwarded SMS, customer names and documents are **untrusted data**. They go into prompts inside clearly marked data blocks. An agent can only produce proposals of the types it's allowed, and every proposal still goes through policy and approval. A malicious email can at most cause a wrong suggestion that the owner sees and declines.

### Privacy and compliance

- **Register with Kenya's Office of the Data Protection Commissioner (ODPC)** as a data processor, and as a controller for our own account data, before launch.
- The database is in the EU (Neon has no Africa region). The Data Protection Act allows transfers abroad with safeguards. **Confirm with a Kenyan data-protection lawyer.**
- Phone numbers are stored encrypted, with a hashed copy for matching. Prompts get only the data the task needs.
- The owner can export or delete their shop's data. Statements and raw events are deleted after a retention period.

### Spend and abuse

- A daily AI budget per shop and a global one, with the rules-only fallback.
- Rate limits on every webhook and endpoint.
- An **attention budget** per owner (default 6 pings a day plus the brief) is enforced by the Chief.

## 9. WhatsApp rules we design around

- **Cadre has its own WhatsApp Business number** on the Meta Cloud API, connected directly with no middleman. Owners opt in during setup.
- **Replies inside the 24-hour customer-service window are free**, including everything Cadre sends after the owner messages it. Outside the window Cadre can only send **pre-approved templates** (the morning brief, approval requests, alerts, all in the "utility" category), which Meta charges per message.
- **Keep the window open:** the morning brief is a short template that asks for a tap ("Reply 1 to see today"). The tap opens a 24-hour window, and the full brief and the rest of the day's pings go out free.
- Meta restricts **general-purpose AI assistants** on the WhatsApp Business Platform. Cadre is a business-specific service: alerts, briefs, approvals and questions about the owner's own shop. It should not be pitched or built as "chat with an AI about anything". **Check Meta's current policy before launch.**
- Messaging the shop's **customers** (receipts, reminders) needs the shop's own WhatsApp number. That means Cadre becomes a Meta Tech Provider with Embedded Signup. It's a later phase, and until then reminders go out as STK Push prompts.

## 10. Running on (nearly) zero

| Need | Free option | When it starts costing |
|---|---|---|
| Hosting, queues, workflows, scheduled jobs | Cloudflare free plan | Past the free request and CPU limits (the paid plan is about $5 a month) |
| Database | Neon free plan | Past about 0.5 GB |
| Sign-in | Clerk free plan | Past its free monthly users |
| Files (statements) | Cloudflare R2 free plan | Past 10 GB |
| Inbound email | Cloudflare Email Routing | Free |
| AI | Rules first, then the Workers AI free allowance | When shops use a lot of free text and voice; startup credits cover Claude |
| WhatsApp | Meta Cloud API, free replies inside the window | Template messages outside the window |
| Daraja | Free API; the shop pays its normal M-Pesa charges | Never for us |
| Cadre's phone number | One Safaricom SIM | About KES 100, once |
| Domain | `*.workers.dev` to start | About $10 a year when you launch |

Charge shops a small monthly fee from the first paying customer. Ads don't fit a business tool that lives in WhatsApp, and a fee shows whether shops value Cadre.

## 11. Build plan

Each phase ends with something a real shop can use.

### Phase 0: Foundations
1. Workspace layout: `apps/cadre` for the console, and the Wanlly tokens in a shared `packages/ui` so Wanlly and Cadre use the same design system.
2. Clerk Organizations, and the Postgres schema for `orgs`, `members`, `integrations`, `agent_settings`, `events` and `audit_log`, with row-level security from the first migration.
3. The console shell from the mockup: setup checklist, connections, your cadre, activity log.
4. Accounts to open (all free): Cloudflare, Neon, Clerk, Meta Business (verification takes time, so start now), Safaricom Daraja sandbox.

**Done when:** an owner can sign up, create a shop and see their console with an empty setup checklist.

### Phase 1: WhatsApp and approvals
1. Cloud API number, webhook with signature check, the `messages` table.
2. Phone verification, opt-in, the first templates submitted to Meta.
3. The action engine with tiers, rules and approvals, using a harmless test action.
4. Approve from a WhatsApp button or the console; both are written to the audit log.

**Done when:** the owner gets a test approval on WhatsApp, taps it, and sees it in the activity log.

### Phase 2: M-Pesa without an API (personal numbers, Pochi, any Till)
1. SMS parser (patterns, with a model as a flagged fallback) and a test suite of real message formats.
2. Forward-to-WhatsApp intake, statement upload with PDF parsing, dedupe by transaction code.
3. The `transactions` ledger.

**Done when:** a shop with only a personal line has every forwarded payment logged correctly, and a statement upload fills the gaps without duplicates.

### Phase 3: Finance and the Chief
1. Customers and the debt book: who owes what, since when.
2. Signals: overdue debts, unusual days, large payments.
3. The Chief: the morning brief from templates, the attention budget, menus and buttons, the window-opening brief.

**Done when:** owners get a morning brief worth reading. Test it with 5 to 10 real shops.

### Phase 4: Daraja for Paybill and Till
1. Guided onboarding per shortcode, encrypted credentials, C2B URL registration.
2. Real-time payment events, verified with Transaction Status above a threshold.
3. STK Push as a Tier 2 action, with result callbacks.

**Done when:** a Till shop gets payments on WhatsApp as they land and can collect a debt with one approved tap.

### Phase 5: Inbox, banks and free text
1. Each shop's inbound email address, the Email Worker, and bank alert parsing into transactions.
2. The model router: free-text questions and voice notes through Workers AI.
3. Equity Jenga.

### Phase 6: Kenya compliance calendar and People basics
1. Deadlines for PAYE, VAT, SHIF, NSSF and the Housing Levy, with reminders.
2. Staff list and a payroll preview with statutory deductions (rates kept in config, reviewed whenever the law changes).

### Phase 7: Payouts
1. B2C executor in its own Worker, step-up approval, limits, reconciliation.
2. Payroll and supplier payments as Tier 3 actions.

### Phase 8: More of the cadre
Operations (stock and restock), Marketing (promos to opted-in customers), Legal (lease and licence reminders, contract summaries), direct Gmail and Outlook, and the shop's own WhatsApp number through Embedded Signup.

## 12. To check before building

1. **Meta's policy on AI on the WhatsApp Business Platform**, and whether Cadre's use case is clearly allowed.
2. **Meta's current rates** for utility templates in Kenya, and the rules on free messages inside the customer-service window.
3. **Daraja:** the current go-live process, which APIs need extra approval (B2C, Pull Transactions), and Safaricom's callback IP ranges.
4. **ODPC registration** and cross-border transfer rules, with a lawyer.
5. **Free-tier limits** for Cloudflare, Neon, Clerk and Workers AI, since they change.
6. **Jenga API** onboarding requirements for small businesses.
