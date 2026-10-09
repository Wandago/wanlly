# Wanlly launch plan

Goal: **1,000 approved beta users in about 8 weeks, with almost no money spent.** The budget is your time, your phone and free tools. Everything here assumes one person working evenings and weekends.

Pages already built (design preview, not wired up yet):
- `/beta` — the launch page and beta application form
- `/admin` — the dashboard for tracking everything (sample data for now)

---

## 1. How the beta works

1. People apply on `/beta`: name, email, country, what they want to build, how they heard about Wanlly, optional invite code.
2. **Every applicant gets an invite link.** Each friend who applies with it moves them up.
3. You approve people in **weekly groups** from the admin page. Start with 50, then 100, then 200, as long as cost and abuse stay under control.
4. Approved people get an email, sign in, verify their phone, and watch one video to unlock their first day.
5. Who goes first: people with invites, people who wrote a real "what I want to build", a mix of countries, and low risk scores.

The applications list is your audience even before people are approved. Email it every week with what you shipped.

## 2. The launch, phase by phase

### Phase 1: Foundation (week 1)
- Put `/beta` live on your domain, with analytics on (section 4).
- Claim the same handle everywhere: X, TikTok, Instagram, LinkedIn, YouTube, Threads. Use the app icon as the avatar and the tagline as the bio.
- Create a WhatsApp Channel. People in Kenya, Nigeria and India share WhatsApp links far more than anything else.
- Write a one-line pitch you'll repeat everywhere: **"Frontier AI, paid for by ads. Watch a short video, earn credits, build your idea."**

### Phase 2: Build in public (weeks 1–5)
The point is that by launch day, a few thousand people have watched Wanlly being made.

**Content pillars**, each one repeatable:
1. **The build diary.** "Day 12 of building a free AI app paid for by ads." A 30–45 second screen recording with voice-over. Show the real thing: the composer, the sponsor card, the economics page.
2. **"Is this even possible?"** Explain the money honestly: what Sonnet costs, what a video pays in Kenya vs the US. People love transparent numbers, and nobody else in AI shows them.
3. **"Built in 4 hours."** Once the app runs, build real things for real people: a booking page for a salon, a price tracker for a farmer. Before and after.
4. **Model explainers.** "Haiku vs Sonnet vs Opus: which one should you use?" Useful content that ranks and gets shared.
5. **Local builders.** Short stories of students and young builders and what they'd build if AI were free.

**Cadence:** one short vertical video a day (cut once, post on TikTok, Reels, Shorts and X), three LinkedIn posts a week, one weekly email to applicants.

**Free tools:** CapCut for editing, OBS for screen recording, Canva for thumbnails, the brand kit for colours and logo, Buffer's free plan to schedule.

### Phase 3: Communities and ambassadors (weeks 3–6)
- **Universities:** contact computer science and engineering clubs and tech societies. Offer to run a free 45-minute "build an app with AI" session in person or on Google Meet. Every attendee gets an invite code.
- **Developer groups:** local Google Developer Groups, coding bootcamp alumni, startup hubs and tech WhatsApp and Telegram groups. Ask the organisers first, then share.
- **Campus ambassadors:** 10–20 students who each get a personal code and extra credits for every approved friend. They're your sales team, paid in credits instead of money.
- **Reddit and Discord:** share genuinely useful posts (the economics breakdown, a build) in communities whose rules allow it. Never spam.

### Phase 4: Launch week (week 6 or 7)
Make it feel like a big-company launch, on zero budget.
- **Day −7: teaser.** A black screen, the logo, the tagline, a date. Post everywhere and pin it.
  Two cuts are ready in `docs/`: the calm 40-second `teaser.html` (for LinkedIn and press) and the high-energy 32-second `promo.html` (for TikTok, Reels, Shorts and WhatsApp status), each exported as 16:9, 9:16 and 4:5 MP4s with original music.
- **Day −3 to −1: countdown.** One feature a day: the sponsor card, the Build Pass, the four models.
- **Day 0: the launch film.** A 90–120 second video with a clean screen recording of building something real, calm voice-over and simple music. Think product keynote, not advert. Post it natively on every platform.
- **Same day:** Product Hunt launch, a "Show HN" post on Hacker News, a LinkedIn post telling your story, a thread on X, and a message to every applicant: "The doors are open for the first group."
- **Day 0 evening:** a live session (X Spaces or Instagram Live) building something with Wanlly and answering questions.
- **Day +1 to +7:** post every approved group ("Group 2 is in!"), share what people built, answer every comment.

### Phase 5: Press (alongside launch week)
- Pitch African and Asian tech media with a short email: who you are, what Wanlly does, why it matters, the launch film, two or three real numbers. The angle: **"Young African builder makes frontier AI free for people who can't afford it, paid for by ads."**
- Pitch tech podcasts and YouTubers who cover AI tools.
- Free coverage needs a story, not a product. Your story is access.

## 3. Weekly targets

| Week | Applications (total) | Approved (total) | What to watch |
|---|---|---|---|
| 2 | 150 | 0 | Which content pillar brings applications |
| 4 | 800 | 50 | First group's feedback, cost per user |
| 6 | 2,500 | 300 | Referral share, ambassador results |
| 8 | 5,000 | 1,000 | Week-1 return rate above 40% |

If cost per user or abuse rises, approve smaller groups. The application list keeps growing either way.

## 4. Tracking everything

The admin dashboard (`/admin`) shows all of this. Data comes from three places.

**1. Our own event tables (Neon)**, written by the server, so ad blockers can't hide them:

| Event | What it records |
|---|---|
| `page_view` | Page, referrer, UTM source and campaign, country, region and city (from Cloudflare), device type |
| `beta_applied` / `beta_approved` / `beta_activated` | Who, when, source, invite code used, country |
| `job_started` / `job_finished` | Tool, model, tokens in and out, cost, duration, success or error |
| `ad_request` | Slot, format, size, page, country, which networks were asked |
| `ad_bid` | Network, bid price, won or lost, response time, timeouts |
| `ad_impression` | Slot, format, creative, network, price paid, viewable or not |
| `ad_click` | Slot, creative, network, tool, country |
| `video_started` / `video_completed` / `reward_granted` | Network, payout, credits granted, verification result |
| `credits_spent` | Model, tool, credits, real cost |
| `risk_flag` | Account, signal, score, automatic action |

**2. Ad network reporting.** Google Ad Manager and other networks have reporting APIs for revenue, eCPM, fill rate and bidding. A nightly job pulls them in so the dashboard matches what you're actually paid. Bid-level detail (who bid what, who won) comes from the bidding setup itself (Prebid's analytics events, when we add header bidding).

**3. PostHog (free tier)** for click heatmaps, session recordings (with personal data masked) and funnels on the beta page and in the app.

**Location precision:** Cloudflare gives country, region and city for every request at no cost. We never store raw IP addresses, only the location and a hashed network prefix for abuse checks.

**Privacy:** the consent banner covers analytics and ads, the privacy policy lists everything above, and people can ask for their data to be deleted.

## 5. Rules for launch content

- Show the real product. No fake screenshots, no promises of features that aren't built.
- Be honest about the model: "paid for by ads" is the hook, so never hide it.
- Name models exactly ("Sonnet 5.5", "Opus 5.5").
- Every post ends with one action: apply at the `/beta` link, ideally with an invite code.
