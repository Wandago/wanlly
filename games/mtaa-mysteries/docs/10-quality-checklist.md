# 10. Quality checklist

Items marked **[auto]** are enforced on every run by `npm run check` (lint, scenario checker and tests) and in CI. Items marked **[e2e]** are checked by `npm run e2e` (a real-browser playthrough; needs Playwright). The rest need a person. Copy this list into each release or scenario review and tick it there.

## Deduction fairness
- [ ] **[auto]** Every variant passes `npm run check:scenarios`: a consistent timeline, truthful clues, only the culprit uncleared, the cover story broken by a decisive board clue, a motive on the board, at least 2 red herrings, and searchable clues ≤ 2 × the minimum player count.
- [ ] **[auto]** Generated scenario docs match the data (lint).
- [ ] The solution path in the doc uses only board evidence, and each step follows from the one before.
- [ ] Two playtesters who haven't read the scenario solve it, or come close, from the evidence alone.
- [ ] No clue relies on knowledge only some players have (unexplained local trivia, a niche brand, a slang word without a gloss).
- [ ] Decisive clues aren't all in one place (a single unlucky search order shouldn't hide the whole case).
- [ ] The culprit's cover story is plausible enough to survive the first minute of discussion.

## Role balance
- [ ] Catch rate per scenario and variant is between 40% and 70% after at least 5 plays.
- [ ] The Detective's two verified searches don't trivialise the case (track catch rate with and without a seated Detective).
- [ ] The Witness's recall narrows the field to at least two people, never one.
- [ ] The Insider's restricted place has no more than one decisive clue.
- [ ] Each innocent's secret makes them suspicious in a way the evidence later resolves.
- [ ] The culprit's lesser secret hints at motive without giving it away.

## Consistency
- [ ] **[auto]** Travel times, presence, absence and "nobody" facts agree with the true timeline.
- [ ] **[auto]** Knowledge is written in the first person, so it reads correctly when posted as a statement.
- [ ] Weather, daylight and opening hours fit the place and time (e.g. a fish banda open at 21:30, rain timing in Kisumu).
- [ ] Phone, M-Pesa and receipt details are plausible (times, amounts, wording).
- [ ] Names, ages and relationships are consistent across intro, bios, cards and clues.
- [ ] Variant overrides don't leave stale references (a clue mentioning the old culprit's motive).

## Mobile usability
- [ ] **[e2e]** No horizontal scroll at 390 px (`npm run e2e`, needs Playwright). Re-test at 320 px by hand.
- [ ] A full case is playable one-handed on a mid-range Android phone over 3G-class mobile data.
- [ ] Reconnection after switching apps (WhatsApp ↔ game) restores the seat within 3 seconds.
- [ ] Tab badges show new board and chat activity. The timer stays visible.

## Accessibility
- [ ] Keyboard-only playthrough: every action is reachable, focus is visible and the order makes sense.
- [ ] Screen readers (TalkBack, VoiceOver): phase changes are announced, the board is readable, and the vote can be cast.
- [ ] Contrast meets WCAG AA in both themes. Larger text and 200% zoom work.
- [ ] Reduced motion is respected. No information is carried by colour alone.
- [ ] The glossary setting works in all three modes, and every Kiswahili or Sheng term in game text is glossed.

## Cultural review (per scenario, by a reviewer from that region)
- [ ] The place is real but the venue, people and events are fictional. No real person, business or case is identifiable.
- [ ] No real current public figure appears as a suspect, victim or reference.
- [ ] Names fit the characters' stated communities and ages, and nobody's community is the joke or the tell.
- [ ] No community, religion, region or occupation is linked to guilt across the library (check the culprit list in `06-scenarios.md`).
- [ ] Kiswahili and Sheng phrases are natural for the speaker, region and age, and correctly glossed.
- [ ] Everyday details are accurate and not caricatured: chama practice, estate committees, askari logbooks, matatu stages, cess receipts, wedding customs, coastal dress, taarab, Old Town architecture.
- [ ] Sensitive themes (land fraud, exam leaks, debt, drinking, licensing) are handled with nuance: specific to these characters, not "how things are in Kenya".
- [ ] Each item in the scenario's "Details needing local review" list has been confirmed or changed.
- [ ] Content notes are accurate and shown before the case.

## Violence and content
- [ ] No graphic description of injury or death anywhere: intro, clues, cards or solution.
- [ ] Methods are described at the level of "struck", "pushed", "something added to his drink". No substance, dose or technique is named.
- [ ] No real unsolved case or real victim is echoed.

## Privacy
- [ ] **[auto]** No player can see another player's secrets, role, hand or the solution before the truth (leak test across all scenarios and variants).
- [ ] **[auto]** Tokens never appear in views. Scenario files are never served.
- [ ] Only display names, room chat and reports are stored; rooms and chat are deleted when the room expires. Document this in the privacy notice.
- [ ] Reports are stored outside the web root and accessible only to moderators.
- [ ] No third-party scripts, fonts or trackers (CSP `default-src 'self'`).

## Moderation
- [ ] **[auto]** Names are cleaned (control and bidi characters, length, letters required, de-duplicated) and blocklisted; chat is rate-limited and length-limited (tests).
- [ ] The blocklist has been reviewed for English, Kiswahili and Sheng, with false positives checked against common Kenyan names.
- [ ] Hosts can mute, remove and hand over hosting. Removed players can't rejoin with the same token.
- [ ] A named owner reviews reports within an agreed time.
- [ ] Public rooms have a visible "Report" option and a code of conduct.

## Release gate
- [ ] `npm run check` passes locally and in CI.
- [ ] End-to-end browser playthrough on phone and desktop: create, join, play to the truth, reconnect, rematch.
- [ ] Every scenario: cultural review signed off, playtested twice.
