# Wanlly legal and compliance checklist

**This is a map of what applies, not legal advice.** Before opening Wanlly to people in the EU, UK or US, have a privacy lawyer review the privacy policy, terms and consent setup. Many startup programs and law-school clinics offer this cheaply or free.

Wanlly collects personal data (names, emails, phone numbers, prompts, files), shows ads, uses cookies, sends data to US AI providers, scores accounts for abuse, and generates AI content. Each of those triggers specific rules.

---

## 1. Where the rules come from

| Law | Applies when | Main duties |
|---|---|---|
| **GDPR** (EU) and **UK GDPR** | Anyone in the EU/UK uses Wanlly | Lawful basis for every use of data, privacy notice, user rights, security, processor contracts, transfer safeguards, breach notice in 72 hours |
| **ePrivacy Directive** (EU cookie law) and UK **PECR** | Cookies or similar tech on EU/UK devices | Consent **before** any non-essential cookie or tracker loads |
| **EU AI Act** | AI system offered in the EU | Tell people they're talking to AI; label AI-generated images, audio and video as artificial (from August 2026) |
| **Digital Services Act** (EU) | Hosting user content, showing ads | Ad transparency (who paid, why shown), no ads based on sensitive data, no profiling-based ads to minors, a way to report illegal content, clear terms |
| **EU consumer law** (Unfair Commercial Practices, Consumer Rights) | Selling or offering "free" services | "Free" must be honest: say clearly that ads and data pay for it; rules on virtual currencies such as credits |
| **Kenya Data Protection Act 2019** | Users in Kenya, or Wanlly run from Kenya | **Register with the Office of the Data Protection Commissioner (ODPC)** as a data controller; similar duties to GDPR; transfer rules |
| **Nigeria NDPA 2023**, **South Africa POPIA**, **India DPDP Act 2023** | Users in those countries | Consent, notices, user rights, local registration in some cases |
| **US: CCPA/CPRA** (California) and other state laws; **COPPA** | US users; children under 13 | "Do not sell or share my personal information" for ad targeting; no data from under-13s |

## 2. What Wanlly must build or write

### Consent and cookies
- [ ] A **Google-certified consent tool** (Google's own "Privacy & messaging" is free) shown to EU, UK and Swiss visitors. Required by Google to serve ads there, and it handles the IAB TCF framework.
- [ ] **Google Consent Mode v2**, so Google tags behave according to the choice.
- [ ] **Accept all** and **Reject all** equally prominent on the first layer. No pre-ticked boxes.
- [ ] Nothing non-essential loads before consent: no analytics, no ads, no session recording.
- [ ] A **Cookie settings** link in the footer and in Settings to change the choice anytime.
- [ ] A cookie policy listing every cookie: name, purpose, provider, duration.
- [ ] Without ad consent, show only non-personalised or contextual ads.

### Accounts and data
- [ ] **Minimum age: 18** for the beta. It removes most child-data rules and ad-targeting limits for minors. Ask at sign-up.
- [ ] **Privacy policy** in plain language: what we collect, why (lawful basis for each), who receives it (Anthropic, Clerk, Neon, Cloudflare, ad networks, PostHog, Resend, Twilio), how long we keep it, where it's stored, and how to use your rights.
- [ ] **Self-serve rights** in Settings: download my data, delete my account, change consents. Answer emailed requests within 30 days.
- [ ] **Retention schedule**: for example prompts and outputs 90 days unless the user keeps a project; abuse logs 12 months; audit log 24 months with personal details minimised; deleted accounts removed within 30 days.
- [ ] Phone numbers used only for verification and security, stated where they're collected.
- [ ] **No training on user content**, stated in the policy and in Settings.
- [ ] Encrypt sensitive data (connection keys, phone numbers) at rest; access logged.
- [ ] A **breach plan**: who decides, how to notify regulators within 72 hours, and how to tell users.

### Processors and transfers
- [ ] Sign the **data processing agreement (DPA)** each provider offers: Anthropic, Clerk, Neon, Cloudflare, PostHog, Sentry, Resend, Twilio, Google.
- [ ] Data going to US companies needs a transfer basis: the **EU-US Data Privacy Framework** where the provider is certified, otherwise **Standard Contractual Clauses**. Most providers include these in their DPA.
- [ ] Keep a **record of processing activities**: a spreadsheet of what data, why, where, how long.
- [ ] Do a **data protection impact assessment (DPIA)** for abuse risk scoring and ad profiling. It's a short written risk review, and regulators expect one for profiling.

### Automated decisions
- [ ] Abuse scoring may slow down or challenge accounts automatically, but **freezes and bans need human review** and an appeal path. GDPR Article 22 limits decisions with significant effects made purely by machines.
- [ ] Explain in the privacy policy that automated checks exist and what they look at.

### AI-specific
- [ ] Tell people they're using AI (the line under the composer) and that answers can be wrong.
- [ ] **Label AI-generated images and video** as AI-generated (visible label plus metadata) when those tools launch.
- [ ] Follow each provider's usage policy: Anthropic's Usage Policy flows down to Wanlly's users through our terms.
- [ ] A way to report harmful output or abuse.

### Ads and rewards
- [ ] Every ad labelled **Sponsored**, and DSA ad transparency: who the advertiser is and the main reason it was shown (one click on the label).
- [ ] No ads targeted using sensitive data (health, religion, politics, sexuality, ethnicity).
- [ ] Rewards only for opt-in video views, never clicks (ad network policies, and fraud law).
- [ ] Credits terms: no cash value, can't be sold or transferred, can expire, what happens when an account closes. Keep credits clearly **not money**, so they aren't treated as e-money or a financial product.
- [ ] Honest "free" claims: say clearly on the landing page that sponsors pay for it.

### Terms of service
- [ ] Who can use Wanlly (18+), acceptable use (no illegal content, no abuse, no reselling, no automated access, no attempts to bypass limits).
- [ ] Ownership: users own what they create; Wanlly gets only the licence needed to run the service.
- [ ] AI output disclaimer, limitation of liability, right to suspend accounts, how disputes are handled, governing law.
- [ ] Connected services: users authorise Wanlly to act on their behalf within the permissions they grant; their own keys (Twilio and similar) and bills are their responsibility.

### Connections
- [ ] **Google**: sensitive and restricted scopes (Gmail, full Drive) require Google's OAuth app verification and possibly a paid annual security assessment. Start with the Drive file picker and per-file Docs and Sheets access.
- [ ] **GitHub**: a GitHub App with per-repository access; publish a short security page explaining what it can do.
- [ ] Store third-party tokens and keys encrypted, delete them on disconnect, and never log them.

### Kenya first
- [ ] **Register Wanlly with the ODPC** before launch (an online form and fee based on size).
- [ ] Appoint someone responsible for data protection (you, at first) and name them in the privacy policy.
- [ ] Transfers of Kenyan users' data abroad (to US AI providers) need appropriate safeguards, which the providers' DPAs cover; mention them in the policy.

## 3. Order of work

| When | Do |
|---|---|
| Before the beta page collects any data | Privacy policy (short version), terms (short version), age 18+ checkbox, consent banner, ODPC registration started |
| Before the first beta group | DPAs signed, retention schedule, self-serve data download and delete, AI disclosure, breach plan |
| Before ads go live | Certified consent tool with Consent Mode v2, cookie policy, ad labels and transparency, credits terms |
| Before opening to the EU at scale | Lawyer review, DPIA for profiling and abuse scoring, record of processing, human review for bans |
| When images and video launch | AI-generated content labels and metadata |
