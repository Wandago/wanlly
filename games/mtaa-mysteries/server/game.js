// The game engine: a pure state machine. No I/O, no timers; `now` is always passed in.
// The server holds this state. Players only ever receive viewFor(game, playerId), which is
// built from an explicit whitelist so hidden roles, secrets and the solution cannot leak.
import { boardClues } from "./scenario.js";
import { parseMap, canStand, clearLine, findPath, SPEED, REACH } from "../client/geom.js";

export const PHASES = ["briefing", "discovery", "investigate1", "investigate2", "arguments", "vote", "resolution"];
export const PHASE_SECONDS = { briefing: 90, discovery: 60, investigate1: 240, investigate2: 240, arguments: 120, vote: 60 };
export const PACE = { quick: 0.75, standard: 1, relaxed: 1.5 };
export const CHAT_MAX = 300;
export const MOVABLE = ["discovery", "investigate1", "investigate2", "arguments"];
export const ERRANDS_FOR_BONUS = 2;
export const REASON_MAX = 280;

export const ROLE_INFO = {
  culprit: { name: "Culprit", ability: "Quiet search (once): one search that isn't announced. The clue you find is still handed in, anonymously, when the round ends." },
  detective: { name: "Detective", ability: "Two searches per investigation round instead of one. Clues you find go straight to the board, marked Verified." },
  witness: { name: "Witness", ability: "Recall (once): remember one more detail about what you saw. Only you see it; share it if you choose." },
  insider: { name: "Insider", ability: "Keys: you can search the restricted location from round 1. Everyone else has to wait until round 2." },
  secret: { name: "Secret-keeper", ability: "No special ability, but your secret looks suspicious. Confessing clears the air and costs you your secret bonus." },
};
const HONESTY = "You may dodge questions and keep your secret, but you may not state anything false. Only the culprit may lie.";

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const charOf = (g, id) => g.scenario.characters.find((c) => c.id === id);
const placeName = (g, id) => g.scenario.places.find((p) => p.id === id)?.name ?? "Case file";
const seatOf = (g, pid) => g.seats.find((x) => x.playerId === pid && !x.left);
const activeSeats = (g) => g.seats.filter((x) => !x.left);
const clueById = (g, id) => g.scenario.clues.find((c) => c.id === id);

function post(g, entry, now) {
  g.board.push({ id: ++g.seq, at: now, ...entry });
}

/**
 * players: [{ id, name, bot }] in join order. The culprit's character is always seated;
 * other characters are seated by scenario.seatPriority, and the rest become non-player characters.
 */
export function createGame({ scenario, players, seed = 1, settings = {}, now = 0, avoidCulprit = null }) {
  const s = scenario;
  if (players.length < s.players.min || players.length > s.players.max) {
    throw new Error(`${s.title} needs ${s.players.min}–${s.players.max} players, not ${players.length}`);
  }
  const rand = rng(seed);
  const culpritChar = Object.keys(s.roles).find((id) => s.roles[id] === "culprit");
  const chars = [culpritChar, ...s.seatPriority.filter((id) => id !== culpritChar).slice(0, players.length - 1)];
  const pool = players.filter((p) => p.id !== avoidCulprit);
  const culpritPlayer = (pool.length ? pool : players)[Math.floor(rand() * (pool.length || players.length))];
  const others = shuffle(players.filter((p) => p !== culpritPlayer), rand);
  const restChars = shuffle(chars.slice(1), rand);
  const seats = [culpritPlayer, ...others].map((p, i) => ({
    playerId: p.id, name: p.name, bot: !!p.bot, charId: i === 0 ? culpritChar : restChars[i - 1],
    role: s.roles[i === 0 ? culpritChar : restChars[i - 1]], left: false,
  }));
  seats.sort((a, b) => players.findIndex((p) => p.id === a.playerId) - players.findIndex((p) => p.id === b.playerId));

  const searchOrder = {};
  for (const p of s.places) searchOrder[p.id] = shuffle(s.clues.filter((c) => c.where === p.id).map((c) => c.id), rand);

  const g = {
    scenario: s, seed, settings: { pace: "standard", scoring: true, map: false, ...settings },
    phase: "briefing", endsAt: 0, extended: false, seq: 0,
    seats, npcs: s.characters.map((c) => c.id).filter((id) => !chars.includes(id)),
    searchOrder, found: {}, board: [], chat: [], searchesLeft: {}, used: {}, ready: [], votes: {},
    connected: Object.fromEntries(players.map((p) => [p.id, true])), muted: [], result: null, version: 0,
  };
  for (const x of seats) g.used[x.playerId] = { quiet: false, recall: false, confessed: false, accused: false, shared: [] };
  if (g.settings.map && s.map) setupMap(g, rand, now);
  else g.settings.map = false;
  enter(g, "briefing", now);
  return g;
}

// ---- The walkable map: positions, clue spots, errands. Positions are server-authoritative.
function setupMap(g, rand, now) {
  const m = parseMap(g.scenario.map);
  g.map = m;
  g.spotClue = {};
  for (const p of g.scenario.places) {
    const spotIdx = m.spots.map((sp, i) => (sp.place === p.id ? i : -1)).filter((i) => i >= 0);
    shuffle(spotIdx, rand).forEach((i, n) => { if (g.searchOrder[p.id][n]) g.spotClue[i] = g.searchOrder[p.id][n]; });
  }
  const spawn = shuffle(m.floors[g.scenario.map.spawn].filter(([x, y]) => /[A-Z]/.test(m.rows[y][x])), rand);
  g.pos = {};
  g.seats.forEach((x, i) => { const [tx, ty] = spawn[i % spawn.length]; g.pos[x.playerId] = { x: tx + 0.5, y: ty + 0.5, t: now }; });
  g.errand = {};
  g.errandsDone = {};
  g.botPlan = {};
}

const openSpot = (g, i) => g.spotClue[i] && !g.found[g.spotClue[i]];

/** A position report from a player. Returns { ok } or { error, x, y } with the server's position to snap back to. */
export function move(g, playerId, x, y, now) {
  const seat = seatOf(g, playerId);
  const cur = g.pos?.[playerId];
  if (!seat || !cur) return { error: "Not on the map." };
  const back = { error: "Move rejected.", x: cur.x, y: cur.y };
  if (!MOVABLE.includes(g.phase)) return { ...back, error: "Wait for the case to open." };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return back;
  const dist = Math.hypot(x - cur.x, y - cur.y);
  const dt = Math.max(0.05, (now - cur.t) / 1000);
  // At most 1.2 tiles per report (walls are a full tile thick, so a legal step can't skip one),
  // and no faster than walking speed with some slack for network jitter.
  if (dist > 1.2 || dist > SPEED * dt * 1.5 + 0.25) return { ...back, error: "Too fast." };
  if (!canStand(g.map.rows, x, y) || !clearLine(g.map.rows, cur.x, cur.y, x, y)) return { ...back, error: "Blocked." };
  g.pos[playerId] = { x, y, t: now };
  const e = g.errand[playerId];
  if (e && Math.hypot(x - e.x, y - e.y) > 0.4) delete g.errand[playerId];
  return { ok: true };
}

/** Other walkers this player can see: within the scenario's sight radius, never further. */
export function positionsFor(g, viewerId, now) {
  if (!g.map || !MOVABLE.includes(g.phase) && g.phase !== "vote") return null;
  const me = g.pos[viewerId];
  const seated = seatOf(g, viewerId);
  const vision = g.scenario.map.vision;
  const others = [];
  if (me && seated) {
    for (const x of activeSeats(g)) {
      if (x.playerId === viewerId) continue;
      const p = g.pos[x.playerId];
      if (p && Math.hypot(p.x - me.x, p.y - me.y) <= vision) {
        const e = g.errand[x.playerId];
        others.push({ id: x.playerId, charId: x.charId, x: round2(p.x), y: round2(p.y), busy: e ? { started: e.startedAt, seconds: e.seconds } : null });
      }
    }
  }
  return { me: me && seated ? { x: round2(me.x), y: round2(me.y) } : null, others, now };
}
const round2 = (n) => Math.round(n * 100) / 100;

function nearestSpot(g, playerId, place) {
  const p = g.pos[playerId];
  let best = -1, bestD = Infinity;
  g.map.spots.forEach((sp, i) => {
    if (!openSpot(g, i) || (place && sp.place !== place)) return;
    const d = Math.hypot(sp.x - p.x, sp.y - p.y);
    if (d <= REACH && d < bestD) { best = i; bestD = d; }
  });
  return best;
}

function errandAct(g, seat, action, now) {
  if (!g.map) return { error: "Errands need the map." };
  if (!open(g, "investigate1", "investigate2")) return { error: "Errands happen in the investigation rounds." };
  const pid = seat.playerId;
  const done = ((g.errandsDone[pid] ??= {})[g.phase] ??= []);
  if (action.type === "errandStart") {
    const spot = g.map.errands.find((e) => e.index === action.index);
    const def = g.scenario.map.errands[action.index];
    if (!spot || !def) return { error: "Unknown errand." };
    if (done.includes(action.index)) return { error: "You've already done that one this round." };
    const p = g.pos[pid];
    if (Math.hypot(spot.x - p.x, spot.y - p.y) > REACH) return { error: "Walk up to the errand first." };
    g.errand[pid] = { index: action.index, startedAt: now, seconds: def.seconds, x: p.x, y: p.y };
    return { ok: true };
  }
  const e = g.errand[pid];
  if (!e) return { error: "You haven't started an errand, or you walked away." };
  if (now - e.startedAt < e.seconds * 1000 - 250) return { error: "Not finished yet." };
  delete g.errand[pid];
  done.push(e.index);
  if (done.length === ERRANDS_FOR_BONUS) {
    g.searchesLeft[pid] = (g.searchesLeft[pid] ?? 0) + 1;
    return { ok: true, bonus: true };
  }
  return { ok: true };
}

/** Practice bots walk to clue spots and search them. Returns true if anything visible changed. */
export function stepBots(g, now) {
  if (!g.map || !open(g, "investigate1", "investigate2")) return false;
  let changed = false;
  for (const x of activeSeats(g).filter((y) => y.bot)) {
    const pid = x.playerId;
    const pos = g.pos[pid];
    let plan = g.botPlan[pid];
    if (plan && !openSpot(g, plan.spot)) plan = g.botPlan[pid] = null;
    if (!plan) {
      if ((g.searchesLeft[pid] ?? 0) < 1) continue;
      const choices = g.map.spots.map((sp, i) => ({ ...sp, i })).filter((sp) => openSpot(g, sp.i)
        && !(g.scenario.places.find((p) => p.id === sp.place)?.restricted && g.phase === "investigate1" && x.role !== "insider"));
      if (!choices.length) continue;
      const target = choices[Math.floor(rng(g.seed + now)() * choices.length)];
      const path = findPath(g.map.rows, pos.x, pos.y, target.x, target.y);
      if (!path) continue;
      plan = g.botPlan[pid] = { spot: target.i, path, last: now };
    }
    let budget = (SPEED * 0.8 * Math.min(1000, now - plan.last)) / 1000;
    plan.last = now;
    while (budget > 0 && plan.path.length) {
      const [tx, ty] = plan.path[0];
      const d = Math.hypot(tx - pos.x, ty - pos.y);
      if (d <= budget) { pos.x = tx; pos.y = ty; budget -= d; plan.path.shift(); }
      else { pos.x += ((tx - pos.x) / d) * budget; pos.y += ((ty - pos.y) / d) * budget; budget = 0; }
      changed = true;
    }
    pos.t = now;
    if (!plan.path.length) {
      g.botPlan[pid] = null;
      const r = act(g, pid, { type: "search", place: g.map.spots[plan.spot].place }, now);
      if (r.clueId && !g.found[r.clueId].published) act(g, pid, { type: "publish", clueId: r.clueId }, now);
      changed = true;
    }
  }
  return changed;
}

function phaseSeconds(g, phase) {
  return Math.round(PHASE_SECONDS[phase] * (PACE[g.settings.pace] ?? 1));
}

function enter(g, phase, now) {
  g.phase = phase;
  g.ready = [];
  if (g.map) { g.errand = {}; g.botPlan = {}; }
  g.extended = false;
  g.endsAt = phase === "resolution" ? 0 : now + phaseSeconds(g, phase) * 1000;
  g.version++;
  if (phase === "discovery") {
    post(g, { kind: "system", text: `Case opened: ${g.scenario.victim.name}. Window: ${g.scenario.window.from}–${g.scenario.window.to} at ${placeName(g, g.scenario.scene)}.` }, now);
    for (const c of g.scenario.clues.filter((x) => x.where === "start")) publishClue(g, c.id, null, now, { auto: true });
    for (const id of g.npcs) postNpcStatements(g, id, now);
  }
  if (phase === "investigate1" || phase === "investigate2") {
    for (const x of activeSeats(g)) g.searchesLeft[x.playerId] = x.role === "detective" ? 2 : 1;
    if (phase === "investigate2") {
      autoPublish(g, now);
      const locked = g.scenario.places.filter((p) => p.restricted).map((p) => p.name);
      if (locked.length) post(g, { kind: "system", text: `Now open to everyone: ${locked.join(", ")}.` }, now);
    }
  }
  if (phase === "arguments") {
    for (const x of activeSeats(g)) g.searchesLeft[x.playerId] = 0;
    autoPublish(g, now);
  }
  if (phase === "resolution") g.result = score(g);
  runBots(g, now);
}

function postNpcStatements(g, charId, now) {
  for (const k of charOf(g, charId).knowledge) {
    post(g, { kind: "statement", charId, npc: true, text: k.text }, now);
  }
}

function publishClue(g, clueId, by, now, { auto = false, verified = false } = {}) {
  const c = clueById(g, clueId);
  const f = (g.found[clueId] ??= { by, phase: g.phase, quiet: false });
  f.published = true;
  post(g, {
    kind: "clue", clueId, title: c.title, text: c.text, place: placeName(g, c.where),
    by: f.quiet && auto ? null : by, verified, auto,
  }, now);
}

function autoPublish(g, now) {
  for (const [clueId, f] of Object.entries(g.found)) {
    if (!f.published) publishClue(g, clueId, f.by, now, { auto: true });
  }
}

/** Advance on timer, or early when every connected human is ready (has voted, in the vote). */
export function tick(g, now) {
  if (g.phase === "resolution") return false;
  const humans = activeSeats(g).filter((x) => !x.bot && g.connected[x.playerId]);
  const done = g.phase === "vote"
    ? humans.every((x) => g.votes[x.playerId] !== undefined)
    : humans.every((x) => g.ready.includes(x.playerId));
  if (now >= g.endsAt || (humans.length > 0 && done)) {
    enter(g, PHASES[PHASES.indexOf(g.phase) + 1], now);
    return true;
  }
  return false;
}

export function extend(g, now) {
  if (g.phase === "resolution" || g.extended) return { error: "The timer can be extended once per phase." };
  g.extended = true;
  g.endsAt = Math.max(g.endsAt, now) + 60_000;
  g.version++;
  return { ok: true };
}

const open = (g, ...phases) => phases.includes(g.phase);

export function act(g, playerId, action, now) {
  const seat = seatOf(g, playerId);
  if (!seat) return { error: "Only seated players can do that." };
  const used = g.used[playerId];
  const r = (() => {
    switch (action?.type) {
      case "ready":
        if (!g.ready.includes(playerId)) g.ready.push(playerId);
        return { ok: true };
      case "unready":
        g.ready = g.ready.filter((p) => p !== playerId);
        return { ok: true };
      case "search": return search(g, seat, action, now);
      case "errandStart":
      case "errandFinish": return errandAct(g, seat, action, now);
      case "publish": {
        const f = g.found[action.clueId];
        if (!f || f.by !== playerId || f.published) return { error: "That clue isn't in your hand." };
        if (g.phase === "resolution") return { error: "The case is closed." };
        publishClue(g, action.clueId, playerId, now);
        return { ok: true };
      }
      case "share": {
        if (!open(g, "discovery", "investigate1", "investigate2", "arguments", "vote")) return { error: "You can share once the case is open." };
        const items = cardKnowledge(g, seat);
        const k = items.find((x) => x.id === action.knowledgeId);
        if (!k) return { error: "Unknown statement." };
        if (used.shared.includes(k.id)) return { error: "You already shared that." };
        used.shared.push(k.id);
        post(g, { kind: "statement", by: playerId, charId: seat.charId, text: k.text }, now);
        return { ok: true };
      }
      case "recall": {
        if (seat.role !== "witness") return { error: "Only the witness can recall." };
        if (used.recall) return { error: "You have already recalled." };
        if (!open(g, "discovery", "investigate1", "investigate2", "arguments")) return { error: "Not now." };
        used.recall = true;
        return { ok: true };
      }
      case "confess": {
        if (used.confessed) return { error: "You already confessed." };
        if (!open(g, "discovery", "investigate1", "investigate2", "arguments", "vote")) return { error: "Not now." };
        used.confessed = true;
        post(g, { kind: "confession", by: playerId, charId: seat.charId, text: charOf(g, seat.charId).secret }, now);
        return { ok: true };
      }
      case "accuse": {
        if (g.phase !== "arguments") return { error: "Accusations open in the closing-arguments phase." };
        if (used.accused) return { error: "One accusation each." };
        if (!activeSeats(g).some((x) => x.charId === action.target)) return { error: "Accuse a character played by someone in this game." };
        const clue = action.clueId && g.board.find((b) => b.kind === "clue" && b.clueId === action.clueId);
        if (action.clueId && !clue) return { error: "Cite a clue that is on the board." };
        used.accused = true;
        post(g, { kind: "accusation", by: playerId, target: action.target, clueId: clue?.clueId ?? null, clueTitle: clue?.title ?? null,
          text: String(action.reason ?? "").slice(0, REASON_MAX) }, now);
        return { ok: true };
      }
      case "vote": {
        if (g.phase !== "vote") return { error: "Voting hasn't started." };
        if (action.target !== null && !activeSeats(g).some((x) => x.charId === action.target)) return { error: "Vote for a character played in this game, or abstain." };
        if (action.clueId && !g.board.some((b) => b.kind === "clue" && b.clueId === action.clueId)) return { error: "Cite a clue that is on the board." };
        g.votes[playerId] = { target: action.target ?? null, clueId: action.target ? action.clueId ?? null : null };
        return { ok: true };
      }
      case "chat": {
        if (g.muted.includes(playerId)) return { error: "The host has muted you for this round." };
        const text = String(action.text ?? "").trim().slice(0, CHAT_MAX);
        if (!text) return { error: "Empty message." };
        const last = [...g.chat].reverse().find((m) => m.by === playerId);
        if (last && now - last.at < 1000) return { error: "Slow down a little." };
        g.chat.push({ id: ++g.seq, by: playerId, text, at: now });
        if (g.chat.length > 300) g.chat.shift();
        return { ok: true };
      }
      default:
        return { error: "Unknown action." };
    }
  })();
  if (r.ok) g.version++;
  return r;
}

function search(g, seat, { place, quiet }, now) {
  if (!open(g, "investigate1", "investigate2")) return { error: "Searching happens in the investigation rounds." };
  let spot = -1;
  if (g.map) {
    // On the map you search the clue spot you're standing at.
    spot = nearestSpot(g, seat.playerId, place);
    if (spot < 0) return { error: "Walk up to a glinting clue spot to search it." };
    place = g.map.spots[spot].place;
  }
  const p = g.scenario.places.find((x) => x.id === place);
  if (!p) return { error: "Unknown place." };
  if (p.restricted && g.phase === "investigate1" && seat.role !== "insider") return { error: `${p.name} is locked until round 2.` };
  if ((g.searchesLeft[seat.playerId] ?? 0) < 1) return { error: "No searches left this round." };
  const next = g.map ? g.spotClue[spot] : g.searchOrder[place].find((id) => !g.found[id]);
  if (!next) return { error: "Nothing left to find there." };
  const used = g.used[seat.playerId];
  const isQuiet = !!quiet && seat.role === "culprit" && !used.quiet;
  if (quiet && !isQuiet) return { error: "You can't search quietly." };
  if (isQuiet) used.quiet = true;
  g.searchesLeft[seat.playerId]--;
  g.found[next] = { by: seat.playerId, phase: g.phase, quiet: isQuiet, published: false };
  if (seat.role === "detective") publishClue(g, next, seat.playerId, now, { verified: true });
  else if (!isQuiet) post(g, { kind: "found", by: seat.playerId, place: p.name }, now);
  return { ok: true, clueId: next };
}

function cardKnowledge(g, seat) {
  const c = charOf(g, seat.charId);
  const items = c.knowledge.map((k) => ({ id: k.id, text: k.text }));
  if (seat.role === "culprit") items.unshift({ id: "cover", text: g.scenario.culprit.cover.text, cover: true });
  if (seat.role === "witness" && g.used[seat.playerId].recall) {
    const k = c.knowledge.find((x) => x.recall);
    if (k) items.push({ id: "recall", text: k.recall, recall: true });
  }
  return items;
}

/** Removes a player mid-game. If the culprit leaves, the case closes early with no scores. */
export function leave(g, playerId, now, reason = "left") {
  const seat = seatOf(g, playerId);
  if (!seat || g.phase === "resolution") return;
  if (seat.role === "culprit") {
    g.seats.forEach((x) => { if (x.playerId === playerId) x.left = true; });
    g.abortReason = `The culprit ${reason === "kicked" ? "was removed" : "left"}, so the case closed early. No scores this round.`;
    enter(g, "resolution", now);
    return;
  }
  seat.left = true;
  g.npcs.push(seat.charId);
  for (const [clueId, f] of Object.entries(g.found)) if (f.by === playerId && !f.published) publishClue(g, clueId, playerId, now, { auto: true });
  post(g, { kind: "system", text: `${seat.name} ${reason === "kicked" ? "was removed" : "left"}. ${charOf(g, seat.charId).name} becomes a non-player character; their statements are on the board.` }, now);
  postNpcStatements(g, seat.charId, now);
  delete g.votes[playerId];
  g.version++;
}

export function score(g) {
  const s = g.scenario;
  const culpritSeat = g.seats.find((x) => x.role === "culprit");
  const reveal = {
    culprit: { charId: culpritSeat.charId, playerId: culpritSeat.playerId, name: charOf(g, culpritSeat.charId).name },
    variantName: s.variantName,
    solution: s.solution,
    decisive: s.solution.decisive.map((id) => ({ id, title: clueById(g, id).title })),
    redHerrings: s.redHerrings.map((r) => ({ ...r, name: charOf(g, r.char).name })),
    seats: g.seats.map((x) => ({ playerId: x.playerId, name: x.name, charId: x.charId, role: x.role, left: x.left })),
    characters: s.characters.map((c) => ({ id: c.id, name: c.name, secret: c.secret })),
    culpritTruth: s.culprit.truth,
    missed: boardClues(s).filter((c) => !g.found[c.id] && c.where !== "start").map((c) => ({ id: c.id, title: c.title, place: placeName(g, c.where) })),
  };
  if (g.abortReason) return { aborted: true, reason: g.abortReason, ...reveal, tally: {}, votes: [], points: {} };

  const votes = activeSeats(g).map((x) => ({ playerId: x.playerId, ...(g.votes[x.playerId] ?? { target: null, clueId: null }) }));
  const tally = {};
  for (const v of votes) if (v.target) tally[v.target] = (tally[v.target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((k) => tally[k] === top);
  const caught = top > 0 && leaders.length === 1 && leaders[0] === culpritSeat.charId;
  const points = {};
  if (g.settings.scoring) {
    const misled = votes.filter((v) => v.playerId !== culpritSeat.playerId && v.target && v.target !== culpritSeat.charId).length;
    for (const x of activeSeats(g)) {
      const lines = [];
      const v = votes.find((y) => y.playerId === x.playerId);
      if (x.role === "culprit") {
        if (!caught) lines.push(["Escaped the vote", 5]);
        if (!caught && misled) lines.push([`Misled ${Math.min(3, misled)} investigator${misled > 1 ? "s" : ""}`, Math.min(3, misled)]);
      } else {
        if (caught) lines.push(["The group caught the culprit", 3]);
        if (v.target === culpritSeat.charId) lines.push(["You voted for the culprit", 2]);
        if (v.target === culpritSeat.charId && s.solution.decisive.includes(v.clueId)) lines.push(["You cited a decisive clue", 1]);
        if (!g.used[x.playerId].confessed && !leaders.includes(x.charId)) lines.push(["Kept your secret without becoming the top suspect", 1]);
      }
      points[x.playerId] = { total: lines.reduce((n, l) => n + l[1], 0), lines };
    }
  }
  return { aborted: false, caught, tally, leaders, votes, points, ...reveal };
}

// ---- Bots (practice players). They search, share what they know, and vote plausibly.
function runBots(g, now) {
  const rand = rng(g.seed + g.board.length + PHASES.indexOf(g.phase));
  for (const x of activeSeats(g).filter((y) => y.bot)) {
    if (g.phase === "discovery") {
      for (const k of cardKnowledge(g, x)) act(g, x.playerId, { type: "share", knowledgeId: k.id }, now);
    }
    if ((g.phase === "investigate1" || g.phase === "investigate2") && !g.map) {
      while ((g.searchesLeft[x.playerId] ?? 0) > 0) {
        const options = g.scenario.places.filter((p) => g.searchOrder[p.id].some((id) => !g.found[id]) && !(p.restricted && g.phase === "investigate1" && x.role !== "insider"));
        if (!options.length) break;
        const r = act(g, x.playerId, { type: "search", place: options[Math.floor(rand() * options.length)].id }, now);
        if (r.clueId && !g.found[r.clueId].published) act(g, x.playerId, { type: "publish", clueId: r.clueId }, now);
        if (!r.ok) break;
      }
    }
    if (g.phase === "vote") {
      const others = activeSeats(g).filter((y) => y.charId !== x.charId && (x.role !== "culprit" || y.role !== "culprit"));
      const accused = g.board.filter((b) => b.kind === "accusation" && b.target !== x.charId).map((b) => b.target);
      const target = accused.length && x.role !== "culprit" ? accused[Math.floor(rand() * accused.length)] : others[Math.floor(rand() * others.length)]?.charId ?? null;
      act(g, x.playerId, { type: "vote", target, clueId: null }, now);
    }
    if (g.phase !== "vote") act(g, x.playerId, { type: "ready" }, now);
  }
}

// ---- Projection: what one player is allowed to see. Whitelist only.
export function viewFor(g, viewerId, now) {
  const s = g.scenario;
  const seat = seatOf(g, viewerId);
  const placeRemaining = (id) => g.searchOrder[id].filter((c) => !g.found[c]).length;
  const view = {
    phase: g.phase, endsAt: g.endsAt, now, extended: g.extended, version: g.version,
    scenario: {
      id: s.id, title: s.title, location: s.location, tone: s.tone, intro: s.intro, variantShown: g.phase === "resolution" ? s.variantName : null,
      victim: { name: s.victim.name, description: s.victim.description },
      window: { ...s.window, scene: placeName(g, s.scene) },
      places: s.places.map((p) => ({ id: p.id, name: p.name, restricted: !!p.restricted, remaining: placeRemaining(p.id) })),
      map: g.map ? {
        tiles: s.map.tiles, legend: s.map.legend, vision: s.map.vision,
        spots: g.map.spots.map((sp, i) => ({ place: sp.place, x: sp.x, y: sp.y, open: !!openSpot(g, i) })),
        errands: g.map.errands.map((e) => ({ index: e.index, place: e.place, x: e.x, y: e.y, ...s.map.errands[e.index] })),
      } : null,
      characters: s.characters.map((c) => ({
        id: c.id, name: c.name, age: c.age, occupation: c.occupation, bio: c.bio, relation: c.relation,
        playedBy: activeSeats(g).find((x) => x.charId === c.id)?.playerId ?? null,
      })),
    },
    seats: g.seats.map((x) => ({
      playerId: x.playerId, name: x.name, charId: x.charId, bot: x.bot, left: x.left,
      connected: !!g.connected[x.playerId], ready: g.ready.includes(x.playerId),
      voted: g.votes[x.playerId] !== undefined, muted: g.muted.includes(x.playerId),
    })),
    board: g.board.map((b) => ({ ...b })),
    chat: g.chat.map((m) => ({ ...m })),
    me: null,
    result: g.phase === "resolution" ? g.result : null,
  };
  if (seat) {
    const c = charOf(g, seat.charId);
    const u = g.used[viewerId];
    view.me = {
      playerId: viewerId, charId: seat.charId, role: seat.role, roleName: ROLE_INFO[seat.role].name, ability: ROLE_INFO[seat.role].ability,
      honesty: seat.role === "culprit" ? "You may lie, including about where you were." : HONESTY,
      goal: seat.role === "culprit" ? s.culprit.objective : c.goal,
      secret: c.secret,
      knowledge: cardKnowledge(g, seat).map((k) => ({ ...k, shared: u.shared.includes(k.id) })),
      hand: Object.entries(g.found).filter(([, f]) => f.by === viewerId && !f.published)
        .map(([id]) => { const cl = clueById(g, id); return { clueId: id, title: cl.title, text: cl.text, place: placeName(g, cl.where), quiet: g.found[id].quiet }; }),
      searchesLeft: g.searchesLeft[viewerId] ?? 0,
      used: { quiet: u.quiet, recall: u.recall, confessed: u.confessed, accused: u.accused },
      canQuietSearch: seat.role === "culprit" && !u.quiet,
      vote: g.votes[viewerId] ?? null,
      errands: g.map ? {
        done: g.errandsDone[viewerId]?.[g.phase] ?? [], active: g.errand[viewerId] ? { index: g.errand[viewerId].index, startedAt: g.errand[viewerId].startedAt } : null,
        forBonus: ERRANDS_FOR_BONUS,
      } : null,
      culprit: seat.role === "culprit" ? { truth: s.culprit.truth, danger: s.culprit.danger ?? "" } : null,
    };
  }
  return view;
}
