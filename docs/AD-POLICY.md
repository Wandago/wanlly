# Ad network policy checklist

Checked 2026-10-10 against each network's published terms. Re-check before adding a network or a new ad format.

## The rule that matters most

**Never reward people for viewing or clicking an ad network's ordinary banners.** Google AdSense, Adsterra, Media.net, Ezoic and AADS all forbid it ("compensate users for viewing ads", "incentives to increase impressions", "incentivized traffic"). Monetag's terms ban "artificial" impressions and its rewarded formats are documented for Telegram Mini Apps only.

What Wanlly does about it (in code):

- "Watch an ad to earn credits", the credits gate and the Builder's rewarded banner show **only directly sold campaigns or Wanlly's own sponsor video**. Network banners are switched off there (`DisplaySlot networks={false}` in `src/components/ads/ad-slot.tsx`).
- Network banners run only in ordinary page spaces (rail, under the composer, over the code, phone bar), with no reward attached.
- Direct advertisers agree to the rewarded "sponsored video" format when they book it.

To earn from networks in the credits flow, use an **official rewarded unit**:

1. Google Ad Manager rewarded ads for web (`OutOfPageFormat.REWARDED`): opt-in, 5 seconds in view, in-app credits allowed, never cash. Declining must not block the site, so keep a no-ad path (credits refill over time).
2. Ezoic Rewarded Ads: built for web apps; needs 250k monthly users or their Incubator.
3. AppLixir: web rewarded video; about 5,000 daily users.
4. Monetag's rewarded SDK, only if Monetag confirms in writing it may run outside Telegram.

## Per network

| Network | Banners in page spaces | Banner in a reward flow | Pop-under / push | Ad-block wall | What to do |
|---|---|---|---|---|---|
| Monetag | OK if `ads.wanlly.africa` is the approved site | Risk | OK (MultiTag) | Unclear | Register `ads.wanlly.africa`; ask support about rewarded SDK on the web |
| Adsterra | **Iframe needs written consent** | Not allowed | OK | Risk | Email Adsterra for iframe consent naming `ads.wanlly.africa`, or don't use it |
| Google AdSense | **Not inside an iframe**: code must sit on wanlly.africa pages | Not allowed (Offerwall can only unlock content) | No pops alongside | OK with Google's own "ad blocking recovery" | Don't put AdSense in the ad frame; pages need real content around ads |
| Google Ad Manager | OK | **OK with its rewarded format only** | n/a | OK (own recovery tool) | Best route for credits; needs an Ad Manager account with demand |
| Media.net | Risk (no double iframes) | Not allowed | Not allowed | Unclear | Poor fit: wants US/UK traffic |
| Ezoic | Follows AdSense rules | OK with Ezoic Rewarded Ads | Unclear | Unclear | Apply when traffic grows |
| AADS | Risk ("AFrame traffic") | Not allowed | Not allowed | Unclear | Low pay; only in plain page spaces |
| HilltopAds | Unverified | Treat as not allowed | Unverified | Unverified | Read their terms before use |
| EthicalAds | n/a | n/a | n/a | n/a | Not a fit (one ad per page, invite only) |

## Before you add or change anything

- [ ] The site registered with the network is the one the tag runs on (`ads.wanlly.africa` for the ad frame).
- [ ] No network tag inside an iframe unless that network allows it in writing.
- [ ] No reward, credit or unlock tied to a network's ordinary banner.
- [ ] Every ad is labelled "Sponsored" and sits outside AI answers.
- [ ] Pages with ads have real content (no ads on empty or error pages).
- [ ] Pop-unders: one network at a time, and never on the same page as AdSense.
- [ ] Ad-block wall: allowed as a request; for Google, use its own recovery messages.
- [ ] Your own clicks and test views are never counted (sign out or use test units).

Payment notes: Monetag pays from $5 (PayPal, Skrill) or $20–30 (Payoneer), weekly. Adsterra pays twice a month via Hyperwallet and others. None pay to M-Pesa directly; Payoneer or PayPal to a local bank is the usual route.
