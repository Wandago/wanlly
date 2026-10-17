// The worked example in docs/07-example-round.md, replayed against the real engine.
// If the rules or scoring change, this test fails until the document is updated to match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScenarios, materialize } from "../server/scenario.js";
import { createGame, act, tick, viewFor } from "../server/game.js";

test("the documented example round plays out exactly as written", () => {
  const scenario = materialize(loadScenarios().find((s) => s.id === "mwangaza-court"), "A");
  const players = ["Amina", "Otieno", "Njeri", "Hassan", "Chebet"].map((name) => ({ id: name.toLowerCase(), name }));
  const T = 0;
  const g = createGame({ scenario, players, seed: 1, now: T });

  // Deal the cards exactly as the document describes.
  const deal = { amina: "brian", otieno: "wambui", njeri: "kevin", hassan: "faith", chebet: "daniel" };
  for (const s of g.seats) { s.charId = deal[s.playerId]; s.role = scenario.roles[s.charId]; }
  g.npcs = ["joseph"];
  g.searchOrder.flat4b = ["c-purse", "c-ledger"];
  g.searchOrder.stairwell = ["c-receipt", "c-cig"];

  const readyAll = (now) => { for (const s of g.seats) act(g, s.playerId, { type: "ready" }, now); tick(g, now); };

  // Briefing: each player sees only their own card.
  assert.equal(viewFor(g, "amina", T).me.roleName, "Culprit");
  assert.equal(viewFor(g, "otieno", T).me.roleName, "Detective");
  assert.equal(viewFor(g, "chebet", T).me.roleName, "Insider");
  readyAll(T + 60_000);

  // Discovery: three start clues, plus Joseph's statement because nobody plays him.
  assert.equal(g.phase, "discovery");
  assert.deepEqual(g.board.filter((b) => b.kind === "clue").map((b) => b.clueId), ["c-msg", "c-found", "c-5a"]);
  assert.ok(g.board.some((b) => b.kind === "statement" && b.charId === "joseph" && b.npc));
  assert.ok(act(g, "amina", { type: "share", knowledgeId: "cover" }, T + 70_000).ok);
  assert.ok(act(g, "njeri", { type: "share", knowledgeId: "k-kevin" }, T + 75_000).ok);
  readyAll(T + 100_000);

  // Investigation, round 1.
  assert.equal(g.phase, "investigate1");
  const t1 = T + 120_000;
  assert.equal(act(g, "otieno", { type: "search", place: "rooftop" }, t1).clueId, "c-live");
  assert.equal(act(g, "otieno", { type: "search", place: "gate" }, t1).clueId, "c-logbook");
  assert.equal(act(g, "chebet", { type: "search", place: "flat4b" }, t1).clueId, "c-purse");
  assert.equal(act(g, "njeri", { type: "search", place: "kiosk" }, t1).clueId, "c-kiosk");
  assert.ok(act(g, "njeri", { type: "publish", clueId: "c-kiosk" }, t1).ok);
  assert.equal(act(g, "hassan", { type: "search", place: "stairwell" }, t1).clueId, "c-receipt");
  assert.equal(act(g, "amina", { type: "search", place: "parking", quiet: true }, t1).clueId, "c-car");
  assert.ok(!g.board.some((b) => b.kind === "found" && b.by === "amina"), "the quiet search leaves no trace");
  readyAll(T + 300_000);

  // Round 2 opens: unshared finds are handed in; Amina's quiet find is anonymous.
  assert.equal(g.phase, "investigate2");
  assert.equal(g.board.find((b) => b.clueId === "c-car").by, null);
  assert.equal(g.board.find((b) => b.clueId === "c-receipt").by, "hassan");
  assert.equal(g.board.find((b) => b.clueId === "c-purse").by, "chebet");
  const t2 = T + 320_000;
  assert.equal(act(g, "chebet", { type: "search", place: "flat4b" }, t2).clueId, "c-ledger");
  assert.ok(act(g, "chebet", { type: "publish", clueId: "c-ledger" }, t2).ok);
  assert.equal(act(g, "njeri", { type: "search", place: "stairwell" }, t2).clueId, "c-cig");
  assert.match(act(g, "hassan", { type: "search", place: "gate" }, t2).error, /Nothing left/);
  assert.ok(act(g, "hassan", { type: "confess" }, t2).ok);
  readyAll(T + 500_000);

  // Closing arguments.
  assert.equal(g.phase, "arguments");
  const t3 = T + 520_000;
  assert.ok(act(g, "otieno", { type: "accuse", target: "brian", clueId: "c-logbook", reason: "Nobody was in the parking yard at 21:21." }, t3).ok);
  assert.ok(act(g, "amina", { type: "accuse", target: "kevin", clueId: "c-cig", reason: "He smokes on those stairs and took her money." }, t3).ok);
  readyAll(T + 600_000);

  // The vote.
  assert.equal(g.phase, "vote");
  const t4 = T + 620_000;
  act(g, "otieno", { type: "vote", target: "brian", clueId: "c-logbook" }, t4);
  act(g, "chebet", { type: "vote", target: "brian", clueId: "c-ledger" }, t4);
  act(g, "hassan", { type: "vote", target: "brian", clueId: "c-live" }, t4);
  act(g, "njeri", { type: "vote", target: "brian", clueId: null }, t4);
  act(g, "amina", { type: "vote", target: "kevin", clueId: "c-cig" }, t4);
  tick(g, t4);

  // Resolution: the score table in the document.
  assert.equal(g.phase, "resolution");
  const r = g.result;
  assert.equal(r.caught, true);
  assert.deepEqual(r.tally, { brian: 4, kevin: 1 });
  const totals = Object.fromEntries(Object.entries(r.points).map(([pid, p]) => [pid, p.total]));
  assert.deepEqual(totals, { amina: 0, otieno: 7, njeri: 6, hassan: 5, chebet: 7 });
  assert.deepEqual(r.missed, [], "every searchable clue was found");
});
