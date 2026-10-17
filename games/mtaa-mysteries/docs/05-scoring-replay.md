# 5. Scoring and replayability

## 5.1 Scoring (implemented in `score()` in `server/game.js`)

**Caught** means the culprit has strictly the most votes. Ties and empty votes let the culprit escape.

| Who | Points | Rewards |
|---|---|---|
| Every innocent | **+3** if the culprit is caught | The shared goal comes first, even for players who abstained |
| Innocent who voted for the culprit | **+2** | Individual judgement |
| …and cited a **decisive** clue with that vote | **+1** | Explaining the evidence, not guessing |
| Innocent who never confessed and wasn't among the top-voted | **+1** | Keeping a secret without derailing the group |
| Culprit, if they escape | **+5** | Surviving the vote |
| Culprit, if they escape | **+1** for each innocent who voted for another innocent (max +3) | Misdirection that worked |
| Culprit, if caught | 0 | |

**Ranges per round:** innocents 0–7, culprit 0–8. The culprit can top a single round, but over a session (the culprit rotates) the group goal dominates: a table that keeps catching the culprit scores 5–7 each per round.

### What is deliberately *not* rewarded
- **Chat volume or speed.** Spamming earns nothing, and chat is rate-limited.
- **Accusations.** They cost nothing and score nothing. The vote is what counts, so throwing random accusations has no upside.
- **Being right without evidence.** A correct vote without a decisive citation earns 2, not 3.
- **Harassment.** It never scores, and reporting and muting are always available.

### Edge cases
- **Ties:** the culprit escapes. Innocents still get +2 (and +1) for their own correct votes.
- **Nobody votes:** the culprit escapes, and earns +5 and no misdirection bonus.
- **Abstentions:** score no vote points, but still share the +3 group result.
- **Disconnected at the vote:** treated as an abstention.
- **A player removed mid-case:** they don't score that round.
- **The culprit leaves:** the round is void, and nobody scores.
- **Multiple culprits:** not supported in v1. The design for later: two culprits, scenarios authored with a joint cover story, and "caught" requiring both to be in the top two. That needs a checker extension (each culprit uncleared, and both covers broken), so it waits for a scenario that needs it.
- **Casual mode:** turn off "Keep score" in the lobby. Results still show the verdict and solution, with no points.

### Session scores
Points add up across rematches in the same room and are shown in the lobby and on the results screen. They aren't stored once the room closes (see the tech plan for accounts later).

## 5.2 Replayability

| Lever | How | Status |
|---|---|---|
| **Rotating culprit player** | The previous round's culprit player is never dealt the culprit again in the next round, when there is a choice | v1 |
| **Random seating** | Which player gets which character is shuffled each round | v1 |
| **Variants** | Each scenario has at least one variant: a different culprit (Mwangaza Court, Class of 2011), a different motive (Timboroa, Kianjogu), a different key relationship (Bahari House), or different clue placement (The High Table). "Surprise me" picks one at random. | v1, all checker-verified |
| **Clue order within a place** | Shuffled per game. The first search of the stairwell may find the receipt book or the cigarette ends. | v1 |
| **Player count** | Fewer players turns characters into NPCs, so different statements are public from the start | v1 |
| **Seasonal packs** | New scenario files dropped into `scenarios/`. Each must pass the checker and the cultural review. Ideas: a Christmas-week *shags* (rural home) visit, a Madaraka Day football final, a school reunion in Kakamega, a Lamu cultural festival. | Content roadmap |
| **Story editor** | A web form over the scenario format, with a live checker panel ("Kevin isn't cleared from 21:20 to 21:22") | Post-launch |

### What can and can't be randomised safely

| Safe to randomise | Not safe without re-checking |
|---|---|
| Who plays which character | Which character is the culprit (needs an authored, checked variant) |
| Order of clues *within* a place | Moving a clue to another place (changes what the Insider can reach in round 1) |
| Which variant is used | Clue times or travel times (can break alibis) |
| Pace and timers | Removing clues (can leave an innocent uncleared) |
| NPC set (from player count) | Swapping a clue's wording or facts between variants |

The checker is the boundary: anything that changes **facts, places or the culprit** must be a variant that passes `npm run check:scenarios`.

## 5.3 Scenario authoring format

Scenarios are JSON files in `scenarios/`. The checker is the specification. Each field below is validated.

```jsonc
{
  "id": "mwangaza-court", "title": "…", "location": "…", "tone": "…", "minutes": 20,
  "players": { "min": 4, "max": 6 }, "teaser": "…",
  "contentNotes": ["…"], "reviewFlags": ["details a local reviewer must confirm"],
  "intro": "Public introduction. Gloss local words as [[harambee|community fundraiser]].",
  "victim": { "id": "grace", "name": "…", "description": "…" },
  "scene": "stairwell",                       // a place id
  "window": { "from": "21:15", "to": "21:25" }, // public time window
  "victimPresent": true,                      // false for e.g. a tampered drink
  "places": [{ "id": "flat4b", "name": "…", "restricted": true }],
  "routes": [["stairwell", "flat4b", 1]],     // minutes on foot; shortest paths are computed
  "characters": [{
    "id": "kevin", "name": "…", "age": 26, "occupation": "…", "bio": "public", "relation": "public",
    "secret": "…", "goal": "…",
    "knowledge": [{ "id": "k-kevin", "text": "First person, as posted on the board",
                    "facts": [{ "char": "kevin", "place": "kiosk", "from": "21:08", "to": "21:28" }],
                    "recall": "witness only, first person" }]
  }],
  "seatPriority": ["brian", "wambui", "…"],   // seating order for smaller tables
  "variantName": "The chairman's cable",
  "roles": { "brian": "culprit", "wambui": "detective", "joseph": "witness", "daniel": "insider", "faith": "secret" },
  "timeline": { "grace": [{ "from": "21:16", "to": "21:40", "place": "stairwell", "note": "…" }] },  // the truth
  "clues": [{ "id": "c-logbook", "where": "gate", "title": "…", "text": "…",
              "facts": [{ "nobody": true, "except": ["joseph"], "place": "parking", "from": "21:21", "to": "21:23" },
                        { "char": "daniel", "place": "gate", "from": "21:10", "to": "21:27", "absent": true }],
              "about": ["joseph"], "tags": ["alibi", "decisive", "motive", "red-herring"] }],
  "culprit": { "objective": "…", "truth": "…", "danger": "…",
               "cover": { "text": "…", "place": "parking", "from": "21:12", "to": "21:30" } },
  "solution": { "motive": "…", "method": "…", "summary": "…", "decisive": ["c-logbook"], "path": ["step", "…"] },
  "redHerrings": [{ "char": "faith", "suspicion": "…", "explanation": "…", "clues": ["c-receipt"] }],
  "variants": [{ "id": "B", "name": "…", "summary": "…",
                 "roles": {}, "culprit": {}, "solution": {}, "redHerrings": [],   // replace if present
                 "characters": { "daniel": { "secret": "…" } },                  // shallow-merge per character
                 "timeline": { "daniel": [] },                                   // replace per character
                 "clues": { "update": { "c-ledger": { "text": "…" } }, "add": [], "remove": [] } }]
}
```

**Fact types:** `{char, place, from, to}` (presence), `{char, place, from, to, absent: true}`, and `{nobody: true, except: [...], place, from, to}`. A fact with only `from` is a single minute.

**Workflow:** write the JSON, then run `npm run check:scenarios` and fix what it reports. Then run `npm run render` to regenerate `docs/scenarios/<id>.md` (lint fails if it is stale). Run a cultural review against the checklist, and playtest twice with people who haven't read it.
