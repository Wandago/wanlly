# Wanlly Sign: build plan

Wanlly Sign is an e-signature product at **sign.wanlly.com**. It works like DocuSign: upload a document, add the people who sign, place fields, send, and get back a sealed PDF with an audit trail. The UI reference is `prototype/sign.html`.

**Naming:** "DocuSign" is a registered trademark. Matching its features is fine. Using its name, logo, colors or "DocuSigned by" wording in the product or its marketing is not. The product is called **Wanlly Sign** everywhere.

## 1. Subdomain setup

Run Sign as part of the **same Next.js app and Cloudflare Worker** as Wanlly, and route by hostname. That way it shares sign-in, the database, design tokens and deploys, with no second app to maintain.

1. **DNS:** in Cloudflare, open the Worker → *Settings → Domains & Routes* → add custom domain `sign.wanlly.com`. Cloudflare creates the DNS record and the certificate. Do the same for `wanlly.com` if you haven't yet.
2. **Routing:** in `middleware.ts`, rewrite requests by host:
   ```ts
   const host = req.headers.get("host") ?? "";
   if (host.startsWith("sign.")) {
     return NextResponse.rewrite(new URL(`/sign${req.nextUrl.pathname}`, req.url));
   }
   ```
   All Sign pages live under `app/sign/…`. Block direct visits to `wanlly.com/sign/*` by redirecting them to the subdomain, so each page has only one URL.
3. **Sign-in:** Clerk shares sessions across subdomains of the same root domain, so a user signed in on `wanlly.com` is already signed in on `sign.wanlly.com`. Add `sign.wanlly.com` to the allowed origins and redirect URLs in the Clerk dashboard.
4. **Signers don't need an account.** Signing links (`sign.wanlly.com/s/<token>`) are public routes that skip Clerk. See §4.
5. **Local dev:** browsers resolve `sign.localhost` to your machine, so `http://sign.localhost:3000` exercises the same middleware.
6. **Email sender:** verify `wanlly.com` in Resend and send from `sign@wanlly.com`. Add SPF, DKIM and DMARC records so signing emails don't land in spam. Deliverability makes or breaks this product.

## 2. Feature parity checklist

| Area | v1 (launch) | Later |
|---|---|---|
| Documents | PDF upload; images; several files in one envelope | Word/Google Docs (convert to PDF server-side) |
| Recipients | Signer, receives a copy; signing order or all at once | Approver, in-person signer, groups, recipient that edits |
| Fields | Signature, initials, date signed, name, text, checkbox; required or optional | Dropdown, radio, formulas, attachments, conditional fields |
| Sending | Subject, message, reminders, expiry | Bulk send from CSV, scheduled send |
| Signing | Consent screen, adopt signature (type or draw), guided Next button, decline, finish later, works on phones | Signer identity checks (SMS code, ID scan) |
| Managing | Folders (inbox, sent, drafts, completed), search, remind, void, copy | Correct a sent envelope, transfer ownership, shared folders |
| Templates | Saved documents with fields placed for roles | Shared team templates, PowerForms (public signing link) |
| Proof | Audit trail, certificate of completion, sealed PDF, SHA-256 hash | Long-term validation (LTV) signatures, qualified signatures (EU) |
| Platform | | REST API, webhooks, embedded signing, Zapier |

**Where Wanlly can beat DocuSign:** it already has models. Add "Summarize this contract", "Flag unusual clauses", and **auto-place fields** (send the page images to the model and get back where the signature, date and name lines are). These cost credits, like every other Wanlly tool.

## 3. Data model (Neon + Drizzle)

```
envelopes           id, owner_id, title, status (draft|sent|completed|declined|voided|expired),
                    signing_order bool, subject, message, remind_days, expires_at,
                    created_at, sent_at, completed_at, final_pdf_key, final_sha256
envelope_documents  id, envelope_id, position, name, r2_key, page_count, sha256
document_pages      document_id, page_no, width_pt, height_pt, image_key   -- previews
recipients          id, envelope_id, role (signer|cc), order, name, email,
                    status (created|sent|viewed|signed|declined|copied),
                    token_hash, token_expires_at, signed_at, ip, user_agent
fields              id, envelope_id, recipient_id, document_id, page_no,
                    type, x, y, w, h (in PDF points), required, value
adopted_signatures  id, user_id or recipient_id, kind (typed|drawn), font, image_key
templates           id, owner_id, title, documents + fields + roles as JSON
envelope_events     id, envelope_id, at, actor, action, ip, user_agent, prev_hash, hash
```

- Store field positions in **PDF points**, not screen pixels, so they land in the same spot at any zoom.
- `envelope_events` is **append-only**. Each row stores the hash of the row before it, so deleting or editing a row breaks the chain and is detectable. Never update or delete these rows.
- Every query for the sender side is scoped to `owner_id` on the server, like the rest of Wanlly.

## 4. How signing works

1. **Send:** for each recipient whose turn it is, create a random 32-byte token, store only its SHA-256 hash, and email the link `sign.wanlly.com/s/<token>`.
2. **Open:** look up the token hash, check expiry and that it's this recipient's turn, log `viewed` with IP and user agent.
3. **Consent:** the signer agrees to use electronic records before any field unlocks. Log it. (US ESIGN Act requires this for consumers.)
4. **Adopt signature:** typed (font choice) or drawn (canvas → PNG). Log it.
5. **Finish:** the server checks every required field is filled, saves values, logs `signed`, and emails the next recipient(s). The browser never decides that an envelope is complete.
6. **Complete:** when the last signer finishes, a background job:
   - stamps every field value onto the original PDF with **pdf-lib**,
   - appends the **certificate of completion** pages (signers, emails, IPs, timestamps, consent, the event list),
   - computes the SHA-256 of the final file and stores it,
   - applies a **digital signature** to the PDF (PAdES) so any later change is flagged in Adobe Reader,
   - uploads it to R2 and emails it to every recipient.
7. **Decline / void / expire:** stop routing, invalidate all tokens, notify everyone.

Rendering in the browser uses **PDF.js** (the prototype already does this for uploads). The 6 field types are plain positioned boxes over the page images.

## 5. Things that cost money or need care

| Item | Detail |
|---|---|
| **Worker CPU** | Stamping and sealing a PDF takes far more than the free plan's 10 ms CPU limit. Run step 6 in a **Cloudflare Queue** consumer on the **Workers paid plan ($5/month)**, which allows up to 5 minutes of CPU. This is Sign's first unavoidable cost. |
| **Email volume** | Resend's free plan is 100 emails/day. One envelope with two signers uses about 5 (two invites, reminders, completed copies), so about **20 envelopes/day**. Plan on Resend's $20/month tier at launch. |
| **Signing certificate** | A self-made certificate seals the PDF, but Adobe shows "validity unknown". To get Adobe's green check you need a certificate from an **Adobe Approved Trust List** provider (a few hundred dollars a year). Fine to start without it: the hash and audit trail still prove integrity. |
| **Storage** | Originals, page previews and sealed PDFs in R2. Keep completed envelopes for at least 7 years by default; R2's free 10 GB fills slowly with PDFs. |
| **Privacy** | Contracts are sensitive. Encrypt R2 objects, use short-lived signed URLs, never send document content to ad partners, and never run AI features on a document unless the sender turns them on. |

## 6. Legal

Not legal advice. Have a lawyer review the consent disclosure, terms and retention policy before launch.

- **US:** the ESIGN Act and UETA make electronic signatures valid when there is **intent to sign, consent to do business electronically, a signature linked to the record, and a record that can be kept and reproduced**. The consent screen, audit trail and sealed PDF cover these.
- **EU/UK:** this is a **simple electronic signature** under eIDAS, which is valid for most business contracts. Advanced and qualified signatures need identity checks and a qualified trust provider. Leave those for later.
- **Excluded documents:** wills, some family-law and court documents, utility shut-off and eviction notices, among others. Say so in the terms.
- **No ads in the signing flow.** Signers didn't choose Wanlly and the documents are sensitive. Sponsor slots stay in the main Wanlly workspace.

## 7. Pricing

- **Free:** 5 envelopes a month (the prototype shows "3 of 5 left"). Signing is always free for recipients.
- **Plus ($8/month, the existing plan):** unlimited envelopes, templates, reminders, branding.
- **AI features** (summarize, flag clauses, auto-place fields) cost credits, earned or paid, like the rest of Wanlly.
- **Later, a Business plan:** API, bulk send, team templates, SSO. This is where e-signature revenue usually comes from.

## 8. Phases

Each phase ends with something you can click on.

### S0: Subdomain (half a day)
Custom domain on the Worker, host-based middleware, Clerk origins, a "Hello from Sign" page at `sign.wanlly.com`, Resend domain verified.

### S1: UI shell
Turn `prototype/sign.html` into components: agreements list, envelope wizard (documents, recipients, field editor, review), envelope detail, templates. Reuse Wanlly's design tokens and AppShell.

### S2: Documents and envelopes
Tables from §3. PDF upload to R2 with signed URLs, page previews with PDF.js, field editor saving positions in PDF points. Drafts autosave.

### S3: Sending and signing
Tokens, invite emails, the public signer page, consent, adopt signature, guided signing, signing order, decline, reminders (Cron Trigger), expiry.

### S4: Completion and proof
Queue consumer that stamps, appends the certificate, hashes, seals and emails the final PDF. Hash-chained event log. A public "verify a document" page: upload a PDF, see whether its hash matches a completed envelope.

### S5: Templates and AI
Templates with roles. Contract summary, clause flags and auto-placed fields, charged in credits.

### Later
Signer SMS verification, bulk send, REST API and webhooks, embedded signing, team accounts, AATL certificate, qualified signatures for the EU.
