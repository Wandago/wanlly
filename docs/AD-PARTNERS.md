# Wanlly ad partners

Who Wanlly works with, in what order, and how to decide. Ad networks change their rules often, so **check each partner's current terms before applying**; the notes below were checked in October 2026.

You don't pick partners once. You **start with the few that will accept a new site, measure them, and add or drop partners** using the numbers on the admin dashboard.

---

## 1. What a partner must do for Wanlly

Score every candidate on these before applying. A "no" on any of the first four rules it out.

| # | Question | Why it matters |
|---|---|---|
| 1 | **Does it work on a website?** (not only in phone apps) | Wanlly is a web app first. Many rewarded and offerwall networks are app-only. |
| 2 | **Does it allow rewards** (credits for watching or completing an offer)? | Credits are Wanlly's whole model. Rewards must be on-platform only (never cash or gift cards). |
| 3 | **Does it confirm a reward server-to-server** (a signed callback to our server)? | Credits only come from verified events. Without a callback we need extra checks (see section 4). |
| 4 | **Does it accept an AI tool with user-generated content, from a new site?** | Some networks need months of history or large traffic. |
| 5 | How much does it pay in **our users' countries**, and how often does it have an ad (fill)? | A partner that pays well in the US but has no ads in Africa or South Asia helps less. |
| 6 | **How does it pay you, and from what minimum?** | Bank wire, Payoneer or PayPal to Kenya; a low minimum payout helps cash flow. |
| 7 | **Does it play well with others?** | Some require being the only ad on the page. |
| 8 | Does it support **consent rules** (Google-certified consent tool, TCF) and block sensitive targeting? | Required to serve ads in the EU and UK; see `docs/LEGAL.md`. |

## 2. The partners, by stage

### Stage 0: before any network approves you (now until AdSense approval)

| Partner | Type | Use in Wanlly |
|---|---|---|
| **House ads** | Our own | Invite a friend, launch news, the community pool. Fills every slot from day one. |
| **Developer-tool affiliate programmes**, through PartnerStack and Impact | Affiliate (paid per sign-up or sale) | Sponsor cards and result lines for hosting, databases and design tools that fit what people are building. |
| **Student Beans**, through the Awin affiliate network | Student discounts, paid per sale | Student offers in the Earn page and sponsor slots. Check UNiDAYS too; its publisher terms weren't confirmed. |

These pay little and don't pay for videos. Since there are no free credits, the beta opens only once AppLixir (Stage 1) is live.

### Stage 1: first real ad revenue (from launch)

| Partner | Type | Notes |
|---|---|---|
| **Google AdSense** | Display (cards, banners, side panel) | Needs a real domain with real pages (home, about, privacy, terms, a public gallery). Approval takes days to weeks. Also the gateway to Ad Manager. |
| **AppLixir** | Rewarded video for websites | Built for web. Sends a **signed server-to-server callback** for each completed view, which matches our "credits only from verified events" rule. **Best first rewarded partner.** |
| **One survey offerwall**: BitLabs or CPX Research | Paid surveys | Pays far more per completion than a video, and works in many countries. BitLabs has signed server callbacks; confirm web support for each. |
| **One app/offer offerwall**: Unity (Tapjoy) web offerwall, AdGem, ayeT-Studios or Lootably | Offers (try an app, sign up) | Unity's web offerwall uses a server-side currency callback but is labelled "in development". Check which of the others support websites and pay to Kenya. |

### Stage 2: more bidders (once AdSense is in good standing, roughly 3 months)

| Partner | Type | Notes |
|---|---|---|
| **Google Ad Manager** (free version for small businesses) | Ad server that runs every slot, plus Google's rewarded ads for web | Needs a non-hosted AdSense account in good standing. **Its rewarded ads for web have no server-side verification** (that's app-only), so they follow the extra checks in section 4. |
| **Ezoic** | Managed bidding with many networks, plus rewarded ads for web | No traffic minimum. Has a rewarded web API; confirm whether it sends a server callback before relying on it. |
| **Prebid header bidding**, through a managed partner | Several exchanges bid for every slot | Keeps video and display prices from dropping as fast. Most exchanges need steady traffic first, so a managed partner sets it up. |

### Stage 3: direct deals (from about 2,000 monthly users)

| Partner | Type | Notes |
|---|---|---|
| **Student-friendly advertisers**, sold directly | Sponsor cards, "Today's Sonnet is brought to you by", sponsor trials, challenges | See the plan's "Student-friendly advertisers". Highest rates; a slice funds the community pool. |
| **EthicalAds** or **Carbon Ads** | Developer-focused, privacy-friendly display | EthicalAds needs about 50,000 pageviews a month and wants to be the only ad on the page, so it fits only a dev-docs or gallery page, not the workspace. Carbon's terms weren't confirmed. |

## 3. How you'll know which partners to keep

Every ad request and result is logged per partner, format and country, and shown on the admin dashboard (`/admin`, "Ad networks and bidding"). Review once a month:

1. **Revenue per 1,000 requests, by country.** The number that matters most. It combines how often a partner has an ad and how much it pays.
2. **Fill rate.** Low fill in Africa or South Asia means that partner doesn't help most users.
3. **Reward reconciliation.** Credits we granted vs views the partner actually paid for. A gap above about 5% means fraud or a broken integration.
4. **Speed.** Slow partners delay the whole page; drop any that time out often.
5. **Invalid traffic deductions.** If a partner claws back a lot of revenue, tighten bot checks before scaling it.
6. **Complaints.** Ads users report as bad or misleading.

Rule of thumb: **keep 2–3 partners for each format** so no single one can switch off your income, and drop the weakest when a new one proves better over a month.

## 4. Rewarded ads without a server callback

Google's rewarded ads for web report the reward in the browser only. Credits from them are handled like this:

1. Our server issues a **single-use view ticket** before the ad starts (user, device, ad slot, time).
2. When the page reports the reward, the server checks the ticket, a realistic watch time, the earning caps and the risk score before granting credits.
3. Those credits are **provisional** for a few days. They're compared with Ad Manager's reports for that slot and reversed if the totals don't match.
4. Users with any risk flag only see partners that send a server callback, such as AppLixir.

## 5. What to do now

1. Shortlist from section 2. Open a publisher account with **AppLixir** and **one survey offerwall** as soon as the domain and the first pages are live.
2. Apply to **AdSense** at the same time (Step 4 in the plan).
3. Join **PartnerStack**, **Impact** and **Awin** for the Stage 0 affiliate offers.
4. Fill in the scorecard in section 1 for each, and email their publisher support about anything unclear (web support, callbacks, payout to Kenya).
5. After a month of traffic, use section 3 to decide what to add.

## 6. Direct advertisers (built)

- **Public page:** `/advertise` explains the audience, the formats (sponsor cards, banners, sponsored videos, pop-up cards, sponsor trials), how pricing works and what Wanlly doesn't advertise, with an application form.
- **Admin → Advertisers:** review applications, reply from your own email, approve, then create a campaign: picture (or an illustration), headline, one line, button, https link, colour, placements, countries, dates, a view cap and the agreed price per 1,000 views. A live preview shows the card as people will see it.
- **Serving:** active campaigns replace the house sponsors in the slots they're booked for, by country and dates, until their view cap. Clicks open the advertiser's link with `utm_source=wanlly&utm_medium=<placement>&utm_campaign=<id>`. Views and clicks are recorded as `campaign:<id>`; earned money (views x price) shows in Advertisers and in Ads & revenue.
- **Before the first campaign:** send the advertiser a short insertion order (dates, placements, price, cap, payment terms) and get paid up front for small tests.
