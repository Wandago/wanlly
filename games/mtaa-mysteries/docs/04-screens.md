# 4. Screens and player journey

The client is a single page (`client/app.js`). Every screen below exists in v1 and was exercised end to end in Chromium at 390×844 (phone) and 1280×900 (desktop).

## 4.1 Journey

```
Home ──create──▶ Lobby (host) ──Start──▶ Briefing ▶ Discovery ▶ Investigation 1 ▶ Investigation 2 ▶ Arguments ▶ Vote ▶ The truth
  │                ▲                                                                                                │
  └──join code────▶ Lobby (guest)          joining mid-case ▶ Spectator view                                     Back to lobby (rematch)
```

A shared link (`/QBRF`) opens Home with the code pre-filled. If the browser already holds a session token for that room, it skips straight back to the player's seat.

## 4.2 Screens

### Home
- Title, a one-line pitch, and a badge with the format (4–6 players, 20 minutes).
- **Join a room:** a 4-letter code (consonants only, so codes can't spell words) and a name.
- **Host a new room:** name, plus a "List this room publicly" checkbox.
- **New here?** The rules in two sentences, a "How to play" button, and a list of open public rooms.
- The tutorial overlay opens automatically on a player's first visit.
- **Settings:** glossary style for Kiswahili and Sheng words, theme, and larger text.

### Lobby
- **Room code** in large type, plus "Copy invite link". A Public or Private badge.
- **Players:** name, connection dot, Host/Bot/Watching badges, and lobby ready state. "More" opens player actions (see 4.5).
- **Host:** scenario cards (title, location, length, players, teaser), with content notes shown for the selected case. Settings for version (Surprise me / A / B), pace, keep score, public listing, and *Add practice bot*.
- **Start the case** is disabled until the player count fits, and its label says how many more players are needed.
- **Guests:** "I'm ready" toggle and the case summary.
- **Scores this session**, once a case has finished.

### Game: shared structure
- **Top bar (sticky):** case title and location, phase name, countdown (turns red under 15 s), connection badge when not live, and the Ready button with a count (e.g. "Ready (2/4)"). The host also gets **+1 min**. On desktop, the phase guide text sits here.
- **Desktop (≥1000 px):** three columns. Left: **My card** and **Case file**. Middle: **Act** (the current phase's controls) and **Evidence board**. Right: **Discussion** and **At the table**.
- **Phone:** one column, with a bottom tab bar for **My card · Case · Act · Board · Chat**, and a dot on Board or Chat when something new arrives. The phase guide moves to the top of the Act tab to keep the top bar small.

### My card (private)
"Private: only you can see this", with a **Hide card** toggle for shared screens. Shows: character name, age and occupation; a role badge and ability; for the culprit, a red box with *what really happened* and *watch out*; goal; the honesty rule; your secret with **Confess** (with confirmation); *what you know, in your own words*, with **Share as a statement** on each item (the culprit's cover story is labelled "Your cover story (a lie)"); **Recall** for the witness; and **Clues in your hand**, each with **Share to the board**.

### Case file
Intro, victim, window and scene; every character with occupation, bio, relationship to the victim, and who plays them (or "Not played"); and the list of places, with restricted ones marked.

### Act
- **Briefing / Discovery:** what to read and what's next.
- **Investigation:** searches left; each place with clues remaining, or "Locked until round 2" / "Searched out"; a **Search** button; and for the culprit, a *Quiet search* checkbox.
- **Arguments:** suspect select, a "clue that proves it" select (board clues only), a 280-character reason, and **Accuse**. Once used, a confirmation message.
- **Vote:** buttons for each other played character ("played by …"), an optional key-evidence select, **Cast secret vote**, **Abstain**, and a counter ("3/5 voted"). Your current vote is shown and can be changed.

### The scene (map mode)
During Discovery, the investigation rounds and Closing arguments, the Act panel shows **The scene**: a top-down site plan drawn on one canvas.
- **What's drawn:** each place's floor in its own tint with its name (🔒 while it's restricted for you), walls, doors and paths; glinting gold clue spots (grey once searched); orange **!** errands (✓ once you've done them this round); players as coloured discs with initials and names, yours with a dark outline; and an orange progress ring around anyone doing an errand. Outside your sight circle, everything is dimmed.
- **Controls:** arrow keys or WASD (whenever you're not typing), tap or click to walk there by the shortest path, or the **Walk to…** menu, which walks you to an open clue spot in that place. One context button changes with where you stand: **Search here (E)** or the errand's name. The culprit also gets a *Quiet search* checkbox.
- **Status line** (read out politely to screen readers): "You're in: Back stairwell. 1 search left. Errands this round: 0/2 for a bonus search."
- **Camera:** desktop shows about 20 tiles across; phones zoom in to about 12 so tapping is easy. The camera follows you.

### Evidence board
Filters (All · Clues · Statements · Accusations), newest first. Entry styles: **Clue** (teal edge; place, finder, *Verified by the detective*, or *handed in anonymously*), **Statement** (gold edge; "a player's claim: innocent players can't lie, but the culprit can"; NPC statements marked as statements to the police), **Confession** (red edge), **Accusation** (orange edge; target, cited clue, reason), and system notes (dashed).

### Discussion
A chat log, "Ask, answer, accuse…", and *At the table*: each player with their character, connection, Ready/Voted/Muted badges, **Hide chat** (personal mute), and **More** (report; for the host, mute for everyone and remove).

### The truth (results)
Verdict ("Caught!" / "The culprit escaped." / "Case closed early"), who played the culprit, and the solution summary. Then: vote bars and the list of who voted for whom, with citations; *your points this round*, line by line; **How it fits together** (motive, method, the numbered solution path, decisive clues, clues never found, and a collapsible "What the culprit really did"); red herrings explained; **everyone's cards** (role and secret); session scores; and for the host, **Back to the lobby for another case**.

### Spectator
The same game layout with no card ("You're watching…"), and chat read-only.

### Overlays
How to play (six steps, the one rule, how to solve it, a worked travel-time example, and "practice with bots"), and Settings. Both close with Escape, the Close button, or a tap on the backdrop.

## 4.3 Public vs private, at a glance

| Shown to everyone | Shown only to you | Never shown until the truth |
|---|---|---|
| Case, cast, places, who plays whom, the board, chat, who's ready, who has voted, clues left per place | Your card, your hand, your vote, the culprit's brief (culprit only) | Other players' roles, secrets and unshared clues; how each person voted; the solution |

## 4.4 Synchronisation and reconnection

- The server is authoritative. Clients send intents (`POST /api/rooms/:code/act`) and receive their personal view over **Server-Sent Events** (`GET /api/rooms/:code/stream`) after every change.
- Each view carries `serverNow`, so countdowns are corrected for clock drift.
- Session tokens are random 128-bit values, stored in `localStorage` per room. Reloading, losing signal or switching apps reconnects automatically (EventSource retries every 2 s), and the first message after reconnecting is the full current view, so nothing needs replaying.
- While disconnected, the top bar shows "Reconnecting…". The player's seat, card and hand stay on the server.
- Drafts (the chat input, accusation text), focus and scroll position survive re-renders, so updates arriving mid-typing don't disrupt the player.

## 4.5 Host powers and protections

| Host can | Host can't |
|---|---|
| Choose the case, version, pace, scoring and public listing (in the lobby) | Skip a phase, or extend more than once per phase |
| Add or remove practice bots | See anyone's card or votes |
| Remove a player (with confirmation) and mute a player for the round | Remove themselves while keeping control (leaving passes hosting on) |
| Hand hosting to another human | Change the case mid-game |
| Extend the timer by 1 minute, once per phase | |

Hosting passes automatically if the host is gone for 30 seconds.

## 4.6 Moderation and safety

- **Report:** any player can report another with a reason (up to 500 characters). The server appends it, with the reported player's last 10 chat messages, to `data/reports.jsonl` (outside the repo, gitignored). v1 has no automatic action; see the roadmap for a review queue.
- **Mute:** *Hide chat* hides one person's messages for you only (stored in your browser). The host's *Mute for everyone* blocks that player from posting for the round.
- **Remove:** the host removes a player; their token stops working (see 3.7 for what happens to their character).
- **Room privacy:** rooms are private by default and joinable only by code. Public rooms are listed only while in the lobby.
- **Names and chat:** names are normalised, stripped of control and invisible formatting characters (including right-to-left override tricks), limited to 2–20 characters, required to contain a letter or digit, de-duplicated ("Amina 2"), and checked against a blocklist that resists simple letter swaps. Chat is limited to 300 characters with whitespace collapsed. Everything is rendered as text, never HTML; the lint step rejects any `innerHTML` assignment. The starter blocklist must be replaced with a reviewed English, Kiswahili and Sheng list before public launch.
- **Content notes** for each case are shown in the lobby before starting.

## 4.7 Accessibility

- Semantic structure: landmarks, a real tab list on mobile, `aria-pressed` and `aria-selected` states, labelled form controls, and a skip link.
- Every phase change is announced in a polite live region ("Investigation, round 1. Search one place…").
- Focus is always visible (3 px outline). Every action is a native button or input, so everything is keyboard-reachable.
- Tap targets are 44 px or more. Layouts reflow to 320 px wide without horizontal scrolling (checked in Chromium at 390 px).
- Colour is never the only signal: badges carry words ("Clue", "Statement", "Verified").
- Light and dark themes (follows the device, or set manually), a larger-text option, and `prefers-reduced-motion` respected.
- Glossary: Kiswahili and Sheng terms show their English meaning in brackets by default; players can switch to tap/hover or turn meanings off.
- The map never requires precise pointing: the **Walk to…** menu and the context button cover everything, and the status line describes where you are. Hosts can also switch the map off for the list mode, which has no canvas at all.
- Text-first: nothing requires audio or voice.

## 4.8 Playing with and without voice

The game never requires voice. Structured phases, the evidence board and accusations with cited clues make a text-only game complete. **Relaxed pace** gives text groups 50% more time. Groups on a voice call play exactly the same way. Public rooms should stick to the in-game chat, so everyone hears the same conversation.

## 4.9 First-time tutorial and practice

1. The How to play overlay opens on a player's first visit (a two-minute read).
2. The lobby suggests **practice bots**: one person can play a whole case alone to learn the flow.
3. `07-example-round.md` walks through a complete round showing what every player sees. It doubles as onboarding for playtest facilitators.
