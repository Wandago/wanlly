# 9. Development roadmap

Each stage has an exit test. Something is "done" when its check passes, not when the code exists.

## Stage 0: Prototype ✅ (this repository)

**Built:**
- Rules engine, 5 roles, scoring, phases and timers
- Rooms: codes, joining, reconnection, spectators, bots, rematch, session scores
- Host powers, mute, remove, report
- 6 scenarios × 2 variants, the fair-play checker, generated scenario docs
- Responsive, accessible client with light and dark themes and glossary settings
- Walkable maps for all six cases: movement checked by the server, sight radius, clue spots, errands, walking bots, keyboard, tap and menu controls
- 70 automated tests, plus an end-to-end browser playthrough that walks and searches on desktop and phone

**Exit test:** `npm run check` passes, and a full case is playable in the browser with 2 humans and 2 bots, including reconnect and rematch. *Met.*

## Stage 1: Private playtests (2–4 weeks)

**Must have:**
- Deploy one instance behind HTTPS near East Africa. Share links with 6–10 test groups across regions (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Nyeri) and age ranges.
- A short post-game survey link on the results screen. Questions: was it solvable, was it fair, did the culprit have a chance, did anything feel off culturally?
- Track per scenario and variant: catch rate, ties, abstentions, clues never found, phases ended early vs on the timer, and disconnects. (Server logs only, no personal data.)
- Fix what testers find confusing in the tutorial and phase guides.

**Exit test:** every scenario played at least 5 times. Catch rate is between **40% and 70%** for each scenario (lower means too hard or too opaque, higher means too easy). No unresolved "unfair" report.

## Stage 2: Accessibility and moderation (2–3 weeks)

**Must have:**
- Screen-reader pass with TalkBack (Android) and VoiceOver (iOS), and a keyboard-only playthrough
- Contrast audit for both themes, and testing at 200% zoom
- A reviewed name and chat blocklist (English, Kiswahili, Sheng), with chat masking
- A report review process (owner and turnaround), plus temporary blocks for abusive IPs
- Persist game state (SQLite or Postgres) so deploys don't end live games
- A privacy notice: what's stored (display names, chat during a room, reports) and for how long

**Exit test:** no critical findings from an accessibility audit using real assistive tech, a moderation runbook written and rehearsed, and a restart in the middle of a case resumes it.

## Stage 3: Scenario expansion (ongoing)

**Must have per new scenario:** it passes the checker, completes the cultural review checklist with a reviewer from that region, and is playtested twice by people who haven't read it.

**Planned:**
- A third variant for each launch scenario
- A seasonal pack (December *shags* visit, a football final, a school reunion in Kakamega, a Lamu festival)
- A Kiswahili-language interface option (needs professional translation and review)

**Later:**
- A story editor: a form over the JSON, with live checker feedback
- Partner mode for 7–8 players
- Map polish: walls that block sight (not just distance), footstep sounds, and character art instead of initials
- Optional two-culprit scenarios (needs a checker extension)

## Stage 4: Launch readiness (2 weeks)

**Must have:**
- Load test: 200 concurrent rooms on the target instance, with p95 action latency under 300 ms from Nairobi on mobile data
- Error tracking and uptime alerts
- Rate limits tuned against playtest data
- Final name clearance (see the pitch document)
- Public rooms fully moderated, or off by default
- A help page

**Later:** accounts and friend lists, cross-session stats, built-in voice, native app wrappers.

**Exit test:** the quality checklist (`10-quality-checklist.md`) is fully ticked for every scenario and for the product.

## Priorities if time is short
1. Playtests and catch-rate tuning (fun and fairness)
2. Moderation basics and persistence (safety and reliability)
3. Accessibility audit (reach)
4. New content (retention)
