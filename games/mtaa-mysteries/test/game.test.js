import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScenarios, materialize, variantIds } from "../server/scenario.js";
import { createGame, act, tick, viewFor, leave, score, PHASES } from "../server/game.js";

const all = loadScenarios();
const scenario = (id = "mwangaza-court", v = "A") => materialize(all.find((s) => s.id === id), v);
const people = (n, bot = false) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, bot }));
const T0 = 1_000_000;

function newGame(n = 5, opts = {}) {
  return createGame({ scenario: scenario(opts.id, opts.v), players: people(n), seed: opts.seed ?? 7, now: T0, ...opts.extra });
}
const seatWith = (g, role) => g.seats.find((s) => s.role === role);
function goTo(g, phase) {
  let now = T0;
  while (g.phase !== phase) { now = g.endsAt; tick(g, now); }
  return now;
}

test("every scenario and variant deals a valid table at 4, 5 and 6 players", () => {
  for (const base of all) for (const v of variantIds(base)) for (const n of [4, 5, 6]) {
    const g = createGame({ scenario: materialize(base, v), players: people(n), seed: n, now: T0 });
    assert.equal(g.seats.length, n);
    assert.equal(g.seats.filter((s) => s.role === "culprit").length, 1, `${base.id}/${v}/${n}: one culprit seated`);
    assert.equal(new Set(g.seats.map((s) => s.charId)).size, n);
    assert.equal(g.npcs.length + n, base.characters.length);
  }
});

test("rejects a table outside the scenario's player range", () => {
  assert.throws(() => newGame(3));
  assert.throws(() => newGame(7));
});

test("the culprit avoids last round's culprit when possible", () => {
  for (let seed = 1; seed < 30; seed++) {
    const g = createGame({ scenario: scenario(), players: people(5), seed, now: T0, avoidCulprit: "p0" });
    assert.notEqual(seatWith(g, "culprit").playerId, "p0");
  }
});

test("phases advance on the timer and early when everyone is ready", () => {
  const g = newGame(4);
  assert.equal(g.phase, "briefing");
  tick(g, T0 + 1000);
  assert.equal(g.phase, "briefing");
  for (const s of g.seats) act(g, s.playerId, { type: "ready" }, T0 + 2000);
  tick(g, T0 + 2000);
  assert.equal(g.phase, "discovery");
  let now = g.endsAt;
  tick(g, now);
  assert.equal(g.phase, "investigate1");
  now = g.endsAt; tick(g, now);
  now = g.endsAt; tick(g, now);
  now = g.endsAt; tick(g, now);
  assert.equal(g.phase, "vote");
  now = g.endsAt; tick(g, now);
  assert.equal(g.phase, "resolution");
  assert.ok(g.result);
});

test("disconnected players don't hold up an early advance", () => {
  const g = newGame(4);
  g.connected.p3 = false;
  for (const s of g.seats.filter((x) => x.playerId !== "p3")) act(g, s.playerId, { type: "ready" }, T0 + 10);
  tick(g, T0 + 10);
  assert.equal(g.phase, "discovery");
});

test("discovery posts the start clues and statements from unplayed characters", () => {
  const g = newGame(4);
  goTo(g, "discovery");
  const s = scenario();
  for (const c of s.clues.filter((x) => x.where === "start")) assert.ok(g.board.some((b) => b.clueId === c.id));
  for (const id of g.npcs) assert.ok(g.board.some((b) => b.kind === "statement" && b.charId === id && b.npc));
});

test("search rules: one per round, restricted places, nothing-left, detective and quiet searches", () => {
  const g = newGame(6);
  goTo(g, "investigate1");
  const innocent = g.seats.find((s) => s.role === "secret");
  assert.match(act(g, innocent.playerId, { type: "search", place: "flat4b" }, T0).error, /locked until round 2/);
  const r = act(g, innocent.playerId, { type: "search", place: "kiosk" }, T0);
  assert.ok(r.ok);
  assert.match(act(g, innocent.playerId, { type: "search", place: "gate" }, T0).error, /No searches left/);
  assert.ok(g.board.some((b) => b.kind === "found" && b.by === innocent.playerId), "the search is announced");
  assert.ok(!g.board.some((b) => b.kind === "clue" && b.clueId === r.clueId), "the clue stays private until shared");

  const insider = seatWith(g, "insider");
  assert.ok(act(g, insider.playerId, { type: "search", place: "flat4b" }, T0).ok, "insider can open the restricted place");

  const det = seatWith(g, "detective");
  const d1 = act(g, det.playerId, { type: "search", place: "gate" }, T0);
  assert.ok(g.board.some((b) => b.clueId === d1.clueId && b.verified), "detective clues publish immediately, verified");
  assert.ok(act(g, det.playerId, { type: "search", place: "parking" }, T0).ok, "detective gets two searches");
  assert.match(act(g, det.playerId, { type: "search", place: "kiosk" }, T0).error, /No searches left/);

  const cul = seatWith(g, "culprit");
  const before = g.board.length;
  const q = act(g, cul.playerId, { type: "search", place: "stairwell", quiet: true }, T0);
  assert.ok(q.ok);
  assert.equal(g.board.length, before, "a quiet search is not announced");

  const now = g.endsAt;
  tick(g, now);
  assert.equal(g.phase, "investigate2");
  const auto = g.board.find((b) => b.clueId === q.clueId);
  assert.ok(auto && auto.by === null && auto.auto, "the quiet find is handed in anonymously");
  assert.ok(g.board.some((b) => b.clueId === r.clueId && b.auto), "unshared finds are published at the next phase");
  assert.match(act(g, cul.playerId, { type: "search", place: "rooftop", quiet: true }, now).error, /can't search quietly/);
});

test("a place reports nothing left without spending a search", () => {
  const g = newGame(6);
  goTo(g, "investigate1");
  const det = seatWith(g, "detective");
  assert.ok(act(g, det.playerId, { type: "search", place: "kiosk" }, T0).ok);
  assert.match(act(g, det.playerId, { type: "search", place: "kiosk" }, T0).error, /Nothing left/);
  assert.equal(g.searchesLeft[det.playerId], 1);
});

test("no player's view contains another player's secrets, role, hand or the solution", () => {
  for (const base of all) for (const v of variantIds(base)) {
    const s = materialize(base, v);
    const g = createGame({ scenario: s, players: people(6), seed: 3, now: T0 });
    goTo(g, "investigate1");
    for (const seat of g.seats) act(g, seat.playerId, { type: "search", place: s.places.find((p) => !p.restricted).id }, T0);
    for (const seat of g.seats) {
      const json = JSON.stringify(viewFor(g, seat.playerId, T0));
      const forbidden = [s.solution.summary, s.solution.motive, s.culprit.truth, s.culprit.cover.text];
      if (seat.role === "culprit") forbidden.splice(2);
      for (const other of g.seats.filter((x) => x !== seat)) {
        const c = s.characters.find((x) => x.id === other.charId);
        forbidden.push(c.secret, c.goal, ...c.knowledge.map((k) => k.text));
        for (const [clueId, f] of Object.entries(g.found)) {
          if (f.by === other.playerId && !f.published) forbidden.push(s.clues.find((x) => x.id === clueId).text);
        }
      }
      for (const text of forbidden) {
        if (seat.role !== "culprit" || text !== s.culprit.cover.text) {
          assert.ok(!json.includes(JSON.stringify(text).slice(1, -1)), `${base.id}/${v}: ${seat.role} can see "${text.slice(0, 40)}…"`);
        }
      }
      assert.ok(!/"role":"(culprit|detective|witness|insider|secret)"/.test(json.replace(/"me":\{.*?"role":"\w+"/, "")), `${base.id}/${v}: another seat's role leaked`);
    }
    const spectator = JSON.stringify(viewFor(g, "nobody", T0));
    assert.ok(!spectator.includes('"me":{'), "spectators get no private card");
  }
});

test("solution and roles are revealed only at resolution", () => {
  const g = newGame(4);
  const s = scenario();
  assert.equal(viewFor(g, "p0", T0).result, null);
  goTo(g, "resolution");
  const json = JSON.stringify(viewFor(g, "p0", g.endsAt));
  assert.ok(json.includes(JSON.stringify(s.solution.summary).slice(1, -1)));
});

function playToVote(n = 5, opts) {
  const g = newGame(n, opts);
  const now = goTo(g, "vote");
  return { g, now, cul: seatWith(g, "culprit") };
}

test("scoring: a clear majority catches the culprit", () => {
  const { g, now, cul } = playToVote(5);
  const decisive = g.scenario.solution.decisive.find((id) => g.board.some((b) => b.clueId === id)) ?? null;
  const innocents = g.seats.filter((s) => s !== cul);
  act(g, innocents[0].playerId, { type: "vote", target: cul.charId, clueId: decisive }, now);
  act(g, innocents[1].playerId, { type: "vote", target: cul.charId, clueId: null }, now);
  act(g, innocents[2].playerId, { type: "vote", target: cul.charId }, now);
  act(g, innocents[3].playerId, { type: "vote", target: null }, now);
  act(g, cul.playerId, { type: "vote", target: innocents[0].charId }, now);
  const r = score(g);
  assert.equal(r.caught, true);
  assert.equal(r.points[cul.playerId].total, 0);
  assert.equal(r.points[innocents[0].playerId].total, 3 + 2 + (decisive ? 1 : 0) + 1);
  assert.equal(r.points[innocents[1].playerId].total, 3 + 2 + 1);
  assert.equal(r.points[innocents[3].playerId].total, 3 + 1, "an abstainer still shares the group win");
});

test("scoring: a tie at the top lets the culprit escape", () => {
  const { g, now, cul } = playToVote(4);
  const [a, b, c] = g.seats.filter((s) => s !== cul);
  act(g, a.playerId, { type: "vote", target: cul.charId }, now);
  act(g, b.playerId, { type: "vote", target: c.charId }, now);
  act(g, c.playerId, { type: "vote", target: null }, now);
  act(g, cul.playerId, { type: "vote", target: c.charId }, now);
  const r = score(g);
  assert.equal(r.caught, false);
  assert.equal(r.points[cul.playerId].total, 5 + 1, "escaped, and misled one investigator");
  assert.equal(r.points[c.playerId].total, 0, "the top suspect loses the secret bonus");
  assert.equal(r.points[a.playerId].total, 2 + 1);
});

test("scoring: nobody votes means the culprit escapes; casual mode gives no points", () => {
  const { g } = playToVote(4);
  assert.equal(score(g).caught, false);
  const casual = newGame(4, { extra: { settings: { scoring: false } } });
  goTo(casual, "resolution");
  assert.deepEqual(casual.result.points, {});
});

test("confessing posts your secret and costs the secret bonus", () => {
  const { g, now, cul } = playToVote(4);
  const inn = g.seats.find((s) => s !== cul);
  act(g, inn.playerId, { type: "confess" }, now);
  assert.ok(g.board.some((b) => b.kind === "confession" && b.by === inn.playerId));
  const r = score(g);
  assert.ok(!r.points[inn.playerId].lines.some(([l]) => l.startsWith("Kept your secret")));
});

test("only the witness can recall, once, and the detail appears only on their card", () => {
  const g = newGame(6);
  goTo(g, "discovery");
  const w = seatWith(g, "witness");
  const other = g.seats.find((s) => s.role === "secret");
  assert.match(act(g, other.playerId, { type: "recall" }, T0).error, /Only the witness/);
  assert.ok(act(g, w.playerId, { type: "recall" }, T0).ok);
  assert.match(act(g, w.playerId, { type: "recall" }, T0).error, /already/);
  assert.ok(viewFor(g, w.playerId, T0).me.knowledge.some((k) => k.recall));
  assert.ok(act(g, w.playerId, { type: "share", knowledgeId: "recall" }, T0).ok);
});

test("accusations need the arguments phase, a seated target, and a board clue", () => {
  const g = newGame(4);
  goTo(g, "investigate1");
  assert.match(act(g, "p0", { type: "accuse", target: g.seats[1].charId }, T0).error, /closing-arguments/);
  const now = goTo(g, "arguments");
  const npc = g.npcs[0];
  assert.match(act(g, "p0", { type: "accuse", target: npc }, now).error, /played by someone/);
  assert.match(act(g, "p0", { type: "accuse", target: g.seats[1].charId, clueId: "c-ledger-not-real" }, now).error, /on the board/);
  assert.ok(act(g, "p0", { type: "accuse", target: g.seats[1].charId, clueId: "c-msg", reason: "x".repeat(500) }, now).ok);
  assert.equal(g.board.at(-1).text.length, 280);
  assert.match(act(g, "p0", { type: "accuse", target: g.seats[1].charId }, now).error, /One accusation/);
});

test("chat is rate-limited and muting blocks it", () => {
  const g = newGame(4);
  assert.ok(act(g, "p0", { type: "chat", text: "habari" }, T0).ok);
  assert.match(act(g, "p0", { type: "chat", text: "again" }, T0 + 200).error, /Slow down/);
  g.muted.push("p1");
  assert.match(act(g, "p1", { type: "chat", text: "hi" }, T0).error, /muted/);
  assert.match(act(g, "spectator", { type: "chat", text: "hi" }, T0).error, /seated/);
});

test("an innocent who leaves becomes a non-player character; the culprit leaving closes the case", () => {
  const g = newGame(5);
  const now = goTo(g, "investigate1");
  const inn = g.seats.find((s) => s.role === "secret");
  act(g, inn.playerId, { type: "search", place: "kiosk" }, now);
  leave(g, inn.playerId, now);
  assert.ok(g.npcs.includes(inn.charId));
  assert.ok(g.board.some((b) => b.kind === "statement" && b.charId === inn.charId && b.npc));
  assert.ok(Object.values(g.found).every((f) => f.by !== inn.playerId || f.published), "their finds are handed in");
  leave(g, seatWith(g, "culprit").playerId, now);
  assert.equal(g.phase, "resolution");
  assert.equal(g.result.aborted, true);
  assert.deepEqual(g.result.points, {});
});

test("a full game of practice bots reaches a scored resolution for every scenario", () => {
  for (const base of all) {
    const g = createGame({ scenario: materialize(base, "A"), players: people(5, true), seed: 11, now: T0 });
    let now = T0, guard = 0;
    while (g.phase !== "resolution" && guard++ < 20) { now = g.endsAt; tick(g, now); } // no humans: timer only
    assert.equal(g.phase, "resolution", `${base.id} finished`);
    assert.equal(g.result.votes.filter((v) => v.target).length, 5, "every bot voted");
    assert.ok(Object.keys(g.result.points).length === 5);
    assert.ok(PHASES.includes(g.phase));
  }
});
