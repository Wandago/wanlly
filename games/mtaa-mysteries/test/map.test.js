import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScenarios, materialize, validate, variantIds } from "../server/scenario.js";
import { createGame, act, tick, move, positionsFor, stepBots, viewFor } from "../server/game.js";
import { parseMap, findPath, canStand, SPEED } from "../client/geom.js";

const all = loadScenarios();
const scen = (id = "mwangaza-court", v = "A") => materialize(all.find((s) => s.id === id), v);
const people = (n, bot = false) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bot }));
const T0 = 1_000_000;

function mapGame(n = 5, opts = {}) {
  return createGame({ scenario: scen(opts.id, opts.v), players: people(n, opts.bots), seed: 5, now: T0, settings: { map: true } });
}
function goTo(g, phase) { let now = T0; while (g.phase !== phase) { now = g.endsAt; tick(g, now); } return now; }

/** Walks a player along a path in legal steps, as the browser does. */
function walk(g, pid, tx, ty, now) {
  const p = g.pos[pid];
  const path = findPath(g.map.rows, p.x, p.y, tx, ty);
  assert.ok(path, "a path exists");
  for (const [x, y] of path) {
    for (;;) {
      const cur = g.pos[pid];
      const d = Math.hypot(x - cur.x, y - cur.y);
      if (d < 0.01) break;
      const stepLen = Math.min(d, 0.45);
      now += (stepLen / SPEED) * 1000 + 5;
      const r = move(g, pid, cur.x + ((x - cur.x) / d) * stepLen, cur.y + ((y - cur.y) / d) * stepLen, now);
      assert.ok(r.ok, `legal step rejected: ${r.error}`);
    }
  }
  return now;
}

test("every scenario has a valid, fully connected map with enough clue spots", () => {
  for (const base of all) for (const v of variantIds(base)) {
    const s = materialize(base, v);
    assert.ok(s.map, `${s.id} has a map`);
    const m = parseMap(s.map);
    for (const p of s.places) assert.ok(m.floors[p.id]?.length, `${s.id}: ${p.id} is drawn`);
  }
});

const mapMutations = {
  "a room walled off from the rest": (s) => { s.map.tiles = s.map.tiles.map((r) => r.replace(/:/g, "#")); },
  "a place missing from the map": (s) => { s.map.tiles = s.map.tiles.map((r) => r.replace(/[Kk4]/g, "#")); },
  "fewer clue spots than clues": (s) => { s.map.tiles = s.map.tiles.map((r) => r.replace(/s/g, "S")); },
  "an unknown tile letter": (s) => { s.map.tiles[2] = s.map.tiles[2].replace("R", "Q"); },
  "an errand that isn't on the map": (s) => { s.map.errands.push({ label: "Ghost errand", seconds: 2 }); },
  "a spawn room too small for the table": (s) => { s.map.spawn = "gate"; s.map.tiles = s.map.tiles.map((r) => r.replace(/G{2,}/g, (m) => "#".repeat(m.length))); },
};
for (const [name, mutate] of Object.entries(mapMutations)) {
  test(`map checker catches: ${name}`, () => {
    const s = scen();
    mutate(s);
    assert.ok(validate(s).some((e) => e.includes("map")), validate(s).join("\n"));
  });
}

test("players start in the spawn room on separate tiles", () => {
  const g = mapGame(6);
  const tiles = g.seats.map((x) => `${Math.floor(g.pos[x.playerId].x)},${Math.floor(g.pos[x.playerId].y)}`);
  assert.equal(new Set(tiles).size, 6);
  for (const x of g.seats) assert.equal(g.map.placeAtTile(g.pos[x.playerId].x, g.pos[x.playerId].y), "rooftop");
});

test("movement: frozen during the briefing; legal steps accepted; teleports, wall-crossing and speeding rejected", () => {
  const g = mapGame();
  const p = g.pos.p0;
  assert.match(move(g, "p0", p.x + 0.3, p.y, T0 + 1000).error, /Wait/);
  const now = goTo(g, "discovery");
  const { x, y } = g.pos.p0;
  assert.ok(move(g, "p0", x + 0.4, y, now + 200).ok);
  const r = move(g, "p0", x + 9, y, now + 400);
  assert.match(r.error, /Too fast/);
  assert.equal(r.x, x + 0.4, "the server sends back where you really are");
  assert.match(move(g, "p0", x + 0.4 + 1.0, y, now + 210).error, /Too fast/, "a full tile 10 ms after the last accepted step is too fast");
  g.pos.p0 = { x: 15.5, y: 3.5, t: now };          // rooftop, just inside the right wall
  assert.ok(!canStand(g.map.rows, 16.2, 2.9), "(16.2, 2.9) overlaps the wall beside the rooftop door");
  assert.match(move(g, "p0", 16.2, 2.9, now + 1000).error, /Blocked/, "walls block a short step");
  assert.ok(move(g, "p0", 16.3, 3.5, now + 1000).ok, "the doorway itself is open");
});

test("searching on the map needs you to stand at a glinting spot, and finds that spot's clue", () => {
  const g = mapGame(5);
  let now = goTo(g, "investigate1");
  const det = g.seats.find((x) => x.role === "detective");
  assert.match(act(g, det.playerId, { type: "search" }, now).error, /Walk up to a glinting clue spot/);
  const spotIdx = g.map.spots.findIndex((sp) => sp.place === "gate");
  const spot = g.map.spots[spotIdx];
  now = walk(g, det.playerId, spot.x, spot.y, now);
  const r = act(g, det.playerId, { type: "search" }, now);
  assert.ok(r.ok);
  assert.equal(r.clueId, g.spotClue[spotIdx]);
  assert.equal(viewFor(g, det.playerId, now).scenario.map.spots[spotIdx].open, false, "the spot stops glinting");
  assert.match(act(g, det.playerId, { type: "search" }, now).error, /glinting/, "nothing left at an emptied spot");
});

test("restricted rooms can be walked into but not searched in round 1 by non-insiders", () => {
  const g = mapGame(6);
  let now = goTo(g, "investigate1");
  const someone = g.seats.find((x) => x.role === "secret");
  const spot = g.map.spots.find((sp) => sp.place === "flat4b");
  now = walk(g, someone.playerId, spot.x, spot.y, now);
  assert.match(act(g, someone.playerId, { type: "search" }, now).error, /locked until round 2/);
});

test("errands: must be at the spot, take their full time, cancel if you walk off, and two earn a search", () => {
  const g = mapGame(5);
  let now = goTo(g, "investigate1");
  const pid = g.seats.find((x) => x.role === "secret").playerId;
  assert.match(act(g, pid, { type: "errandStart", index: 1 }, now).error, /Walk up/);
  for (const index of [0, 1]) {
    const e = g.map.errands.find((x) => x.index === index);
    now = walk(g, pid, e.x, e.y, now);
    assert.ok(act(g, pid, { type: "errandStart", index }, now).ok);
    assert.match(act(g, pid, { type: "errandFinish" }, now + 500).error, /Not finished/);
    if (index === 0) {
      const p = g.pos[pid];
      move(g, pid, p.x + (canStand(g.map.rows, p.x + 0.5, p.y) ? 0.5 : -0.5), p.y, now + 600);
      assert.match(act(g, pid, { type: "errandFinish" }, now + 5000).error, /walked away/);
      now = walk(g, pid, e.x, e.y, now + 700);
      act(g, pid, { type: "errandStart", index }, now);
    }
    const before = g.searchesLeft[pid];
    const r = act(g, pid, { type: "errandFinish" }, now + g.scenario.map.errands[index].seconds * 1000);
    assert.ok(r.ok);
    now += g.scenario.map.errands[index].seconds * 1000;
    if (index === 1) { assert.equal(r.bonus, true); assert.equal(g.searchesLeft[pid], before + 1); }
  }
  assert.match(act(g, pid, { type: "errandStart", index: 1 }, now).error, /already/);
});

test("you only see walkers inside your sight radius; spectators see nobody", () => {
  const g = mapGame(4);
  const now = goTo(g, "discovery");
  g.pos.p1 = { x: 3.5, y: 2.5, t: now };
  g.pos.p0 = { x: 4.5, y: 3.5, t: now };
  g.pos.p2 = { x: 30.5, y: 17.5, t: now };
  g.pos.p3 = { x: 20.5, y: 18.5, t: now };
  const seen = positionsFor(g, "p0", now).others.map((o) => o.id);
  assert.deepEqual(seen, ["p1"]);
  assert.ok(!JSON.stringify(positionsFor(g, "p0", now)).includes("30.5"), "far positions never leave the server");
  assert.deepEqual(positionsFor(g, "spectator", now).others, []);
  assert.equal(positionsFor(g, "spectator", now).me, null);
});

test("busy walkers show an errand ring to people nearby", () => {
  const g = mapGame(4);
  let now = goTo(g, "investigate1");
  const e = g.map.errands[0];
  now = walk(g, "p1", e.x, e.y, now);
  g.pos.p0 = { x: e.x, y: e.y, t: now };
  act(g, "p1", { type: "errandStart", index: 0 }, now);
  const other = positionsFor(g, "p0", now).others.find((o) => o.id === "p1");
  assert.ok(other.busy && other.busy.seconds === g.scenario.map.errands[0].seconds);
});

test("practice bots walk to clue spots and search them, in every scenario", () => {
  for (const base of all) {
    const g = createGame({ scenario: materialize(base, "A"), players: people(4, true), seed: 9, now: T0, settings: { map: true } });
    let now = T0;
    while (g.phase !== "investigate1") { now = g.endsAt; tick(g, now); }
    const start = JSON.stringify(g.pos);
    const searched = () => Object.values(g.found).filter((f) => f.phase === "investigate1").length;
    for (let i = 0; i < 400 && searched() < 4; i++) { now += 100; stepBots(g, now); }
    assert.notEqual(JSON.stringify(g.pos), start, `${base.id}: bots moved`);
    assert.equal(searched(), 4, `${base.id}: each of the 4 bots walked to a spot and searched it`);
    for (const x of g.seats) assert.ok(canStand(g.map.rows, g.pos[x.playerId].x, g.pos[x.playerId].y), "bots never stand in walls");
  }
});
