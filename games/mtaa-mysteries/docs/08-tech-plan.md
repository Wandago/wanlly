# 8. Technical implementation plan

The playable first version is **built and running** (`npm start`). This document describes it, explains the choices, and lists what changes as it grows.

## 8.1 Stack (v1)

| Layer | Choice | Why | Trade-off |
|---|---|---|---|
| Server | **Node.js ≥ 20, standard library only** (`node:http`, `node:crypto`) | No dependencies to audit, update or pay for. Runs anywhere Node runs. | No framework conveniences, but the API is five routes |
| Realtime | **Server-Sent Events** for server→client, plain `POST` for client→server | Built into browsers, auto-reconnects, passes through proxies and mobile networks, needs no WebSocket library | One-way stream; actions are separate requests (fine at this message rate) |
| Client | **Vanilla JavaScript module, no build step**, plus one CSS file | Loads fast on low-end Android phones over mobile data. Nothing to compile. | Hand-written DOM helpers instead of React |
| State | **In memory, in one process** | The simplest correct design for short-lived rooms. Nothing personal is stored. | A restart ends running games (see 8.6) |
| Content | **JSON scenarios** plus a checker | Writers can author without code, and the checker proves fairness | JSON is verbose (a story editor comes later) |
| Tests | `node:test` | Built in | |

Nothing in the core loop depends on a paid service or a third-party API. There are no external fonts, scripts or analytics. The Content Security Policy is `default-src 'self'`.

## 8.2 Architecture

```
Browser ──POST /api/rooms/:code/act {token, type, …}──▶ Rooms.action ──▶ game.act (pure)
   ▲                                                         │
   └──── SSE /api/rooms/:code/stream?token=… ◀── notify() ◀──┘  viewFor(game, playerId) per listener
                                     ▲
                       setInterval 1 s: Rooms.tickAll → game.tick (phase timers, host failover, cleanup)
```

- **`server/game.js`**: a pure state machine. `createGame`, `act`, `tick`, `leave`, `score`, and `viewFor`. It takes `now` as a parameter (no clocks, no I/O), so every rule is unit-testable and replayable.
- **`server/rooms.js`**: room codes, people, tokens, host powers, moderation, rematches, session scores. It turns a room into per-player views and pushes them only when that player's view changed.
- **`server/scenario.js`**: loads scenarios, materialises variants, computes travel tables, and runs the **fair-play checker**. The server refuses to start if any scenario fails it.
- **`server/index.js`**: HTTP routing, static files (only from `client/`), SSE, request limits, rate limits and security headers.
- **`server/text.js`**: name and chat cleaning, plus the blocklist.

### Map mode
- **Shared geometry:** `client/geom.js` (walkability, collision, sliding, breadth-first paths, map parsing) is loaded by the browser *and* imported by the server, so prediction and validation use the same rules.
- **Movement:** the browser moves you immediately and sends `POST /api/rooms/:code/pos {x, y}` about 10 times a second while you move. The server accepts a report only if it is at most 1.2 tiles from the last accepted one, no faster than walking speed (with slack for lag), on a standable position, and along a wall-free line. Otherwise it replies `409` with your real position, and the browser snaps back. Before a search or errand, the browser sends its latest position and waits for it to be accepted.
- **Sight, server-side:** a 100 ms loop sends each listener a `pos` event containing only the walkers inside that player's sight radius, and only when it changed. Hidden positions never reach the browser.
- **Bots:** the same loop walks practice bots along breadth-first paths to open clue spots.
- **Cost:** movement doesn't rebuild the full per-player views. Those are still sent only when game state changes.

## 8.3 Data model

```
Room { code, hostId, isPublic, people[], scenarioId, variant, settings{pace, scoring}, game?, scores{playerId: n}, lastCulprit }
Person { id, token (secret), name, bot, connected, lastSeen, spectator, ready }
Game {
  scenario (materialised variant), seed, settings, phase, endsAt, extended,
  seats[{ playerId, name, charId, role, bot, left }], npcs[charId],
  searchOrder{ placeId: [clueId] }, found{ clueId: { by, phase, quiet, published } },
  board[{ id, at, kind: clue|statement|confession|accusation|found|system, … }], chat[{ id, by, text, at }],
  searchesLeft{ playerId }, used{ playerId: { quiet, recall, confessed, accused, shared[] } },
  ready[], votes{ playerId: { target, clueId } }, connected{}, muted[], result?,
  // map mode only:
  map (parsed tiles), pos{ playerId: { x, y, t } }, spotClue{ spotIndex: clueId }, errand{ playerId: {…} }, errandsDone{ playerId: { phase: [index] } }, botPlan{}
}
```

For persistence later, a Postgres mapping: `rooms`, `people` (token stored hashed), `games` (the game state as JSONB, with a version), `game_events` (an append-only action log for replays and dispute review), and `reports`. v1 needs none of these.

## 8.4 Server-authoritative secrets

- Roles, cards, the found-clue registry and the solution exist **only on the server**.
- `viewFor` builds each player's view from an **explicit whitelist**. It never spreads scenario objects into the output. A player's view contains public data, plus their own card and hand, plus the culprit brief only if they are the culprit. The `result` (solution, roles, votes, secrets) appears only once the phase is `resolution`.
- Tokens never appear in any view. Room views list people by public id.
- Scenario files are outside the static root and aren't served. `/api/scenarios` returns public metadata only. A test checks that no solution text appears in it.
- **Enforced by tests:** for every scenario and variant, each seated player's serialized view is searched for every other player's secret, goal and knowledge text, every unshared clue, the solution and the culprit's story (`test/game.test.js`). A deliberately leaky build was used to confirm the test fails.

## 8.5 Reconnection behaviour

1. Join or create returns `{code, token, playerId}`. The client stores `{token, playerId}` under `mtaa:session:CODE` in `localStorage`.
2. The page opens an EventSource with the token. The server marks the person connected and immediately sends the full current view.
3. On a network drop, EventSource retries every 2 s. The server marks the person disconnected (they no longer block early phase-ends, and a missing vote counts as an abstention).
4. On return (same tab, reload, or reopening the link), the stored token restores the same seat and the full state.
5. If the token is unknown (the room expired or the player was removed), the stream sends `{removed}`, and the client clears the session and returns home with a message.
6. If storage is unavailable (private browsing), the game still works for the session; it just can't resume after closing the tab.

## 8.6 Deployment outline

**v1 (playtests, early launch): one small Node process.**
- Any host that runs a long-lived Node process: a small VPS, Fly.io, Railway or Render. Set `PORT`, and optionally `DATA_DIR` for reports.
- Put it behind HTTPS (the platform's TLS or Caddy). SSE needs response buffering off on any reverse proxy (`X-Accel-Buffering: no` for nginx).
- One process holds every room in memory. A modest VM handles hundreds of concurrent rooms: each action touches one room, and views are a few KB.
- **Restarts end live games.** Deploy between sessions, or add the persistence below.
- Observability: stdout logs and a report file. Later, error tracking and a basic uptime check.

**Growth path (only when needed):**
1. **Persistence:** save game state after each action (a SQLite file, or Postgres as in 8.3), so restarts resume rooms.
2. **Several processes:** route each room to one process by code (sticky routing), or move each room into a **Cloudflare Durable Object** or similar per-room actor. The engine is pure, so it moves unchanged.
3. **Accounts** (optional): only for cross-session stats and friend lists. Not needed for play.

## 8.7 Trade-offs and decisions

| Decision | Chosen | Rejected and why |
|---|---|---|
| Realtime transport | SSE + POST | WebSockets need a library or a hand-rolled protocol, and are more fragile on some mobile networks. |
| Framework | None | React or Next would add a build step and dependencies with no real need at this size |
| Storage | Memory | A database would add operational cost before there is anything worth keeping |
| Anti-cheat | Server-only secrets | Client-side obfuscation can't be trusted |
| Scenario format | JSON + checker | A DSL or code would be harder for writers; free text can't be machine-checked |
| Bots | Simple and rule-based | LLM bots would add cost and an external dependency to the core loop |

## 8.8 Unresolved implementation decisions

- **Hosting provider and region.** A host close to East Africa matters for latency. Confirm with a playtest from Nairobi, Mombasa and Kisumu on mobile data.
- **Persistence timing:** before or after the first public launch (see roadmap).
- **Moderation pipeline:** who reviews `reports.jsonl`, how often, and what actions exist beyond in-room removal (e.g. temporary IP blocks).
- **Blocklist:** needs a reviewed English, Kiswahili and Sheng list, and a decision on whether to block or mask words in chat (v1 only blocks names).
- **Voice:** a link-out to the group's own call is enough for v1. Built-in voice (WebRTC) is a later, optional add-on.
- **Token in the stream URL:** EventSource can't send headers, so the session token travels as a query parameter. Make sure the reverse proxy doesn't log query strings, or switch to a short-lived stream ticket issued by a POST.
- **Analytics:** none in v1. If added, it must be privacy-respecting and cover only aggregate case stats (catch rate per scenario and variant).
