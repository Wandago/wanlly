# 6. Scenario library

> **Spoilers below the table.** Each linked document contains the full solution.

Six launch scenarios, each with a second variant. Every variant passes the fair-play checker (`npm run check:scenarios`). The per-scenario documents are **generated from the game data** (`npm run render`), so the docs and the game can't disagree. Each one includes a computed fairness audit showing which clues clear which characters.

| # | Case | Where | Social world | Structure | Variants | Doc |
|---|---|---|---|---|---|---|
| 1 | The Treasurer of Mwangaza Court | South C, Nairobi | Apartment-block residents' committee, a harambee, chama debts | Alibi grid: a live stream, an askari logbook and a kiosk receipt against a dark stairwell | A: the chairman · **B: the caretaker** (culprit swap) | [mwangaza-court](scenarios/mwangaza-court.md) |
| 2 | Blackout at Bahari House | Old Town, Mombasa | Heritage hotel, staff loyalty, a sale to Nairobi investors | Identification: a power cut, one distinctive garment, a photo from the roof | A: a bribed report · **B: an inherited grudge** (relationship) | [bahari-house](scenarios/bahari-house.md) |
| 3 | Class of 2011 | Lakeside lodge, Kisumu | University reunion, an old exam-leak scandal, friendships under strain | Weather and footprints: rain at 21:40 dates the tracks; "nobody" evidence breaks an alibi | A: the lecturer · **B: the sponsor** (culprit swap) | [class-of-2011](scenarios/class-of-2011.md) |
| 4 | The High Table | Garden wedding, Nakuru | Wedding families, a land gift that was sold twice | Daytime tampering: the victim is away and the glass sits alone. Photo logs and a live stream | A: original placement · **B: new hiding places** (clue placement) | [the-high-table](scenarios/the-high-table.md) |
| 5 | The Last Stop Before Timboroa | Highway stopover near Timboroa | A touring band, music royalties, truckers at night | Locked room: a padlocked store, explained by a spare key | A: song credits · **B: door money** (motive) | [last-stop-timboroa](scenarios/last-stop-timboroa.md) |
| 6 | Short Weight at Kianjogu Market | Market town, Nyeri County | Farmers' cooperative AGM, a tampered scale | Morning, rural: meeting minutes and a weighing log against a market-stall alibi | A: short weight · **B: ghost members** (motive) | [short-weight](scenarios/short-weight.md) |

**Variety check:**
- **Victims:** a schoolteacher-treasurer, a hotel manager, a deputy principal, a land surveyor, a band manager, and a farmers' cooperative chairwoman. None is a celebrity or a politician.
- **Settings:** five regions, from day and night, city to rural.
- **Methods:** a fall, two blows, a tampered drink, a blow in a locked room, a toppled stack.
- **Culprits:** a chairman, an architect, a lecturer, an uncle, a guitarist, a vice-chair, plus the variant culprits: a caretaker and a businessman.
- **Communities:** no community is cast as the guilty one. Culprits come from varied backgrounds across the cases, and every red herring is an innocent with a sympathetic reason.

## Scenario template (what each document contains)

1. Title, location, tone, play time, player range, variants, content notes
2. Public introduction, victim, window and scene
3. Cast: public bios and relationships to the victim, plus the seating order for smaller tables
4. Places and the full travel-time matrix
5. Clues: starting clues, and searchable clues by place (restricted places marked), each with the facts it establishes and its tags (motive, decisive, alibi, red herring)
6. Private role cards for every character (the culprit's card with what really happened, cover story and danger)
7. The complete true timeline
8. Per variant: roles, solution (culprit, motive, method, summary, decisive clues), the reasoning path, red herrings with their real explanations, and the computed **fair-play audit** (who is cleared by which clues, and which clues break the cover story)
9. Details needing local review, as a checklist

## How each scenario was audited

1. **Machine:** the checker proves the timeline is consistent, clues tell the truth, only the culprit stays uncleared, the cover story breaks, and the clue count is findable. It runs on every commit (lint, tests and CI).
2. **Reasoning path:** each document's solution path uses only board evidence, never a private card or the ending.
3. **Bot playthrough:** `test/game.test.js` plays every scenario to a scored resolution with bots.
4. **Still to do before launch:** human playtests and the cultural review (see `10-quality-checklist.md`). Every scenario lists the specific details a local reviewer must confirm.
