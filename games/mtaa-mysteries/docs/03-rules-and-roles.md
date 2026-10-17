# 3. Full rules and role system

These rules are what the server enforces (`server/game.js`). Where this document and the code disagree, the code is the bug report: fix one of them.

## 3.1 Player count and scaling

| Players | How it plays | What changes |
|---|---|---|
| **4** | Tight and fast. Every clue matters. | Characters are seated by the scenario's `seatPriority`, and the culprit's character is always seated. The other two characters become **non-player characters (NPCs)**, and their statements are posted to the board at Discovery. With 4 players there are 8 searches (more if the Detective is seated), and no scenario has more than 8 searchable clues, so a careful group can find everything. |
| **5 (recommended)** | The best balance of voices to evidence. | One NPC. |
| **6** | The most social. More bluffing, more noise. | Every character is played. The Detective and Witness are usually seated. |
| 7–8 (later) | | Planned "partner" mode: two players share one character card and one vote. Not in v1. |
| 1–3 | Practice only | The host fills seats with **practice bots**. Bots share what they know, search at random and vote plausibly. They are there to teach the flow, not to be a challenge. |

Each scenario declares its own range (`players.min`/`max`). All six launch scenarios are 4–6.

## 3.2 Phases, timing and what is allowed

Standard pace is shown. Quick multiplies every timer by 0.75, Relaxed by 1.5 (recommended for text-only groups and for first games).

| Phase | Time | Allowed actions | Ends when |
|---|---|---|---|
| Briefing | 90 s | Read card · Ready | Timer, or every connected human is Ready |
| Discovery | 60 s | Chat · share a statement · confess · witness recall · Ready | Same |
| Investigation 1 | 240 s | Search (1, Detective 2) · share a clue from your hand · chat · share a statement · confess · recall · Ready | Same. Unshared finds are then published under the finder's name. |
| Investigation 2 | 240 s | As round 1. Restricted places are now open to all. | Same, plus auto-publish |
| Closing arguments | 120 s | One accusation each (suspect + optional cited clue + 280-character reason) · chat · statement · confess · Ready | Same |
| Vote | 60 s | Vote or abstain (can be changed until the end) · chat · share a statement · confess | Timer, or every connected human has voted |
| Resolution | – | Chat · host: back to lobby | Host action |

The host may add **+1 minute once per phase**. The host **cannot skip** a phase. Phases end early only when every connected human is ready, so a host who is also the culprit can't rush the investigation.

## 3.3 Information: who knows what

| Information | Who sees it | When |
|---|---|---|
| Case intro, victim, window, scene, places, cast bios, who plays whom | Everyone, including spectators | From Briefing |
| Your character's secret, goal, knowledge, role and ability | You only | Always |
| The culprit's true story, cover story and danger notes | The culprit only | Always |
| A clue you found | You only, until you share it or the round ends | During investigation |
| That someone searched a place | Everyone ("Kamau searched the Gate and found something") | Immediately, unless it was the culprit's quiet search |
| How many clues remain at each place | Everyone | Always (a count dropping without an announcement hints at a quiet search) |
| Statements, confessions, accusations, shared clues | Everyone | When posted |
| Who has voted | Everyone (yes/no) | During the vote |
| How each person voted, everyone's role and secret, the full solution | Everyone | Resolution only |

The server builds each player's view from a whitelist (`viewFor`). Other players' roles, secrets, unshared clues and the solution are never sent to a browser before resolution, and a test enforces this for every scenario and variant (`test/game.test.js`).

## 3.4 Honesty: deliberate deception vs innocent secrecy

- **The culprit may lie** about anything, including where they were. Their card offers a ready-made cover story, which they can post as a statement exactly like an innocent's.
- **Innocent players may not state anything false.** They may refuse to answer, change the subject, keep their secret, delay sharing a clue until the round ends, or tell only part of the truth.
- **Why it works:** the rule turns every innocent statement into evidence and every contradiction into a lead. It also makes secrets interesting rather than toxic. "I won't say where I was" is suspicious but allowed, and the secret bonus gives innocents a reason to do it.
- **Statements are written in each character's own words.** Knowledge on your card is phrased exactly as it appears when you share it, and the scenario checker requires this.
- **Enforcement:** the rule is social; the game can't detect a lie in chat. It is stated on every card and in the tutorial. Lying as an innocent mostly hurts your own team, since the scoring rewards innocents only when the group catches the culprit.

## 3.5 Private messages

**Not in v1.** All discussion is public. Private messages invite collusion between friends, can't be moderated fairly, and let a culprit hold side conversations the group never sees. Later option: *whispers* that are visible as "Amina whispered to Kamau" with hidden content, capped at one per round.

## 3.6 Death, elimination and spectators

- Nobody is eliminated. The victim is always a non-player character. Every player stays in the game until the vote.
- **Spectators** (people who join mid-case) can read the case, the board and the chat, but can't post. A spectator can't feed hints to a friend. Spectators are dealt in when the host starts the next case.

## 3.7 Disconnects, late arrivals and leaving

| Situation | Rule |
|---|---|
| A player disconnects | Their seat stays. The page reconnects automatically with a token stored in the browser and shows the current state. While away, they don't hold up early phase-ends, and a missing vote counts as an abstention. |
| A player rejoins | The same link and browser restore the same seat, card and hand. |
| Someone joins mid-case | They become a spectator (see 3.6). |
| An innocent leaves or is removed | Their character becomes an NPC. Their knowledge is posted to the board as police statements, and any clues in their hand are published under their name. The case continues. |
| The culprit leaves or is removed | The case closes immediately, the solution is shown and nobody scores. (The alternative, a game with an unplayable culprit, is worse.) |
| The host disconnects | After 30 seconds, hosting passes to the earliest-joined connected human. |
| Lobby idle | A disconnected player is dropped from the lobby after 2 minutes. Rooms with nobody connected for 30 minutes are deleted. |

## 3.8 Voting

- **Simultaneous and secret.** Votes are revealed together at Resolution. Players see only who has voted.
- **Who you can vote for:** any character played by someone at the table (the culprit is always a played character). NPCs can't be voted for.
- **Abstaining** is allowed and counts for nothing.
- **Changing your vote** is allowed until the phase ends.
- **Caught** means the culprit has strictly more votes than anyone else. **A tie at the top, or no votes at all, lets the culprit escape**, giving the benefit of the doubt to the accused.
- **Missing votes** (disconnected or timed out) count as abstentions.
- **Citing a clue** with your vote is optional. A decisive clue earns +1 if your vote is correct.

## 3.9 Cheating and how it's discouraged

| Risk | Defence |
|---|---|
| Inspecting network traffic or page source for the answer | Secrets are server-only. The browser gets only your own card, and the solution only at Resolution. Scenario files are never served. |
| Reading the scenario docs in this repo | The docs are marked as spoilers and live outside the served folder. Each scenario has variants that change the culprit, motive or clue placement, chosen at random by default. |
| Two friends on a voice call outside the game | Can't be prevented. Recommend the in-game chat for public rooms, and keep strangers in separate rooms. Scoring rewards the group, not individuals, so collusion pays little. |
| Screen-sharing your card | Allowed in casual groups. The card has a Hide toggle for shared screens. |
| Host griefing | No phase skipping, one extend per phase, kicks need confirmation, and the host can't see anyone's card. |
| Spam and flooding | 1 chat message per second, 300 characters each, about 30 API actions per 5 seconds per player, and an 8 KB request limit. |

## 3.10 Role system

Every scenario assigns each character one role per variant. Roles change **what you know or can do**. None of them decides the solution.

| | **Culprit** | **Detective** | **Witness** | **Insider** | **Secret-keeper** |
|---|---|---|---|---|---|
| **Count** | Exactly 1 (always played) | 0–1 | 0–1 | 0–1 | The rest |
| **Public identity** | Their character, like everyone else. The role is hidden. | Character only. They may claim the role; their Verified clues prove it. | Character only | Character only. Keys are often implied by the occupation (caretaker, clerk). | Character only |
| **Private information** | What really happened, a cover story, "danger" notes, and a lesser true secret | Secret, goal, own knowledge | Secret, goal, a sighting, plus one Recall detail | Secret, goal, own knowledge | Secret, goal, own knowledge |
| **Goal** | Not be the top vote | Catch the culprit, keep their secret | Same | Same | Same |
| **Ability** | **Quiet search** (once): not announced. The clue is still handed in anonymously at round end. | **Two searches** per round, and their clues publish immediately, marked Verified | **Recall** (once, before the vote): reveals one more detail on their own card | **Keys**: may search the restricted place in round 1 | None |
| **Limits** | Can't destroy evidence. Everything they find reaches the board by the next phase. | Verified clues can't be held back as leverage | The detail narrows the field but never names anyone | Restricted place only, and round 1 only (everyone gets in during round 2) | – |
| **May conceal** | Anything | Their secret; timing of sharing | Their secret; the recall | Their secret | Their secret |
| **May misrepresent** | **Anything** | Nothing | Nothing | Nothing | Nothing |
| **Scoring** | +5 escape, +1 per misled innocent (max 3) | Innocent scoring | Innocent scoring | Innocent scoring | Innocent scoring |

**Confess** (any player, once): posts your secret to the board. It's useful when your secret is making you the main suspect. Innocents lose the +1 secret bonus for confessing. The culprit's confession reveals a lesser true secret, which may point towards their motive, so confessing is a gamble for them too.

### Why each ability is fair

- **Quiet search** lets the culprit get first look at a clue and lie about the area for one round. It can't hide evidence permanently, and the dropping clue count at that place is a public hint.
- **Detective** speeds up the investigation. Verified clues give the table one source of indisputable facts, which the culprit has to work around.
- **Witness** adds testimony that narrows the field. Recall details are written to fit several characters ("a green event lanyard; committee members and helpers all had one").
- **Insider** creates an early information gap. The rest of the table has to trust or test the Insider's report until round 2.

## 3.11 The fair-play guarantee

A case ships only if `npm run check:scenarios` passes for **every variant**. The checker (`server/scenario.js`, `validate`) proves:

1. **The truth is physically possible.** Every character's true timeline has no overlaps, and every move respects the travel times between places.
2. **Clues never lie.** Every fact a clue or an innocent's statement asserts ("Kevin at the kiosk 21:08–21:28", "nobody in the parking yard 21:21–21:23") matches the true timeline.
3. **Exactly the culprit remains.** Using only clues that reach the board (starting and searchable clues, never a player's private knowledge), every innocent is *cleared*: for every minute of the window, some fact places them elsewhere and too far away to reach the scene by that minute. The culprit is not cleared.
4. **The cover story breaks.** The culprit's cover story is false, and at least one board clue contradicts it. That clue is marked decisive.
5. **There is a motive** on the board, decisive clues are listed, and there are **at least two red herrings**, each pointing at an innocent who is cleared.
6. **It is findable.** Searchable clues number at most 2 × the minimum player count, so a careful group can find everything.
7. **Hygiene.** Roles are valid, there is exactly one culprit, the witness has a recall, glossary markup is well-formed, knowledge is in the first person, and details needing local review are listed.

The mutation tests in `test/scenarios.test.js` break each rule on purpose and confirm the checker catches it.

**What the checker can't judge:** whether the clues *feel* fair, whether the motive is believable, and whether the cultural details are right. That is the human review in `10-quality-checklist.md`.
