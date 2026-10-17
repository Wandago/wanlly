# Mtaa Mysteries

A social deduction murder-mystery game for 4–6 players in the browser. Each case is set somewhere in Kenya. One player is the culprit, and only the culprit may lie. Search for clues, test alibis against the clock, and vote.

```
npm start              # http://localhost:8080 (PORT to change)
npm run check          # lint + scenario fairness checker + tests
npm run e2e            # real-browser playthrough (needs Playwright; prints SKIP without it)
npm run render         # regenerate docs/scenarios/*.md from scenarios/*.json
```

There are no dependencies: Node ≥ 20 and its standard library only. To play alone, host a room and add three practice bots.

## Design documents

| # | Document |
|---|---|
| 1 | [Pitch and title options](docs/01-pitch.md) |
| 2 | [Rules on one page](docs/02-rules-summary.md) |
| 3 | [Full rules and role system](docs/03-rules-and-roles.md) |
| 4 | [Screens and player journey](docs/04-screens.md) |
| 5 | [Scoring, replayability and the scenario format](docs/05-scoring-replay.md) |
| 6 | [Scenario library](docs/06-scenarios.md) (spoilers), with one generated document per case in [docs/scenarios/](docs/scenarios/) |
| 7 | [A fully worked example round](docs/07-example-round.md) (spoilers; replayed by `test/example-round.test.js`) |
| 8 | [Technical implementation plan](docs/08-tech-plan.md) |
| 9 | [Development roadmap](docs/09-roadmap.md) |
| 10 | [Quality checklist](docs/10-quality-checklist.md), including the cultural review |

## Layout

```
server/index.js      HTTP routes, SSE stream, static client, limits, security headers
server/rooms.js      rooms, codes, tokens, host powers, moderation, rematch, scores
server/game.js       the rules engine (pure; time is passed in) and per-player views
server/scenario.js   scenario loading, variants, travel times, and the fair-play checker
server/text.js       name/chat cleaning and blocklist
client/              index.html, app.js, style.css: no build step
scenarios/*.json     the six cases (spoilers)
scripts/             check-scenarios, render-scenarios, lint, e2e
test/                node:test suites, including the leak test and the worked example
```

## Rules that are enforced, not just written

| Rule | Gate |
|---|---|
| Every case is solvable from board evidence, and only the culprit stays uncleared | `scripts/check-scenarios.js` (and the server refuses to start otherwise) |
| No player ever receives another player's secrets, role, hand, or the solution early | Leak test across all scenarios and variants (`test/game.test.js`) |
| Scenario docs match the game data | `npm run lint` fails on stale docs |
| The worked example in the docs matches the engine | `test/example-round.test.js` |
| Player text is never rendered as HTML | Client uses text nodes; lint rejects `innerHTML =` |

## Status

A playable first version. Before public launch, see the roadmap: playtests, a reviewed blocklist, persistence, and cultural review sign-off for each scenario. Details flagged for local review are listed at the end of each scenario document.
