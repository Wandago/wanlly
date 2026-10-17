import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScenarios } from "../server/scenario.js";
import { Rooms } from "../server/rooms.js";
import { cleanName, cleanChat } from "../server/text.js";

const T0 = 5_000_000;
function setup(humans = 4) {
  const reports = [];
  const rooms = new Rooms(loadScenarios(), { onReport: (r) => reports.push(r) });
  const host = rooms.create("Wanjiku", {}, T0);
  const others = Array.from({ length: humans - 1 }, (_, i) => rooms.join(host.code, `Player ${i + 1}`, T0));
  const sent = {};
  for (const p of [host, ...others]) rooms.connect(host.code, p.token, (body) => { (sent[p.playerId] ??= []).push(JSON.parse(body)); }, T0);
  return { rooms, host, others, sent, reports, room: rooms.rooms.get(host.code) };
}

test("names are cleaned, de-duplicated and filtered", () => {
  assert.equal(cleanName("  Ken‮ya  ").name, "Ken ya");
  assert.match(cleanName("a").error, /2 characters/);
  assert.match(cleanName("!!!").error, /letter/);
  assert.match(cleanName("sh1t head").error, /different name/);
  assert.equal(cleanName("Mavis").name, "Mavis");
  assert.equal(Array.from(cleanName("Nyambura".repeat(5)).name).length, 20);
  assert.equal(cleanChat("hello\nthere", 300).text, "hello there");
  const { rooms, host } = setup(2);
  assert.equal(rooms.join(host.code, "wanjiku", T0).error, undefined);
  assert.ok(rooms.rooms.get(host.code).people.some((p) => p.name === "wanjiku 2"));
});

test("room codes are four consonants and join is case-insensitive", () => {
  const { rooms, host } = setup(1);
  assert.match(host.code, /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  assert.ok(rooms.join(host.code.toLowerCase(), "Otieno", T0).token);
  assert.match(rooms.join("QQQQ", "Otieno", T0).error, /No room/);
});

test("only the host can configure and start; starting needs enough players", () => {
  const { rooms, host, others } = setup(2);
  assert.match(rooms.action(host.code, others[0].token, { type: "start" }, T0).error, /Only the host/);
  assert.match(rooms.action(host.code, host.token, { type: "start" }, T0).error, /needs 4–6 players/);
  assert.ok(rooms.action(host.code, host.token, { type: "addBot" }, T0).ok);
  assert.ok(rooms.action(host.code, host.token, { type: "addBot" }, T0).ok);
  assert.ok(rooms.action(host.code, host.token, { type: "setScenario", scenarioId: "short-weight", variant: "B" }, T0).ok);
  assert.ok(rooms.action(host.code, host.token, { type: "start" }, T0).ok);
  const g = rooms.rooms.get(host.code).game;
  assert.equal(g.scenario.id, "short-weight");
  assert.equal(g.scenario.variantId, "B");
});

test("players get live views; the view never includes tokens", () => {
  const { rooms, host, sent } = setup(4);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  const last = sent[host.playerId].at(-1);
  assert.equal(last.game.phase, "briefing");
  assert.ok(last.game.me.charId);
  assert.ok(!JSON.stringify(last).includes(host.token));
});

test("someone joining mid-game is a spectator without a card", () => {
  const { rooms, host } = setup(4);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  const late = rooms.join(host.code, "Late Comer", T0);
  assert.equal(late.spectator, true);
  const room = rooms.rooms.get(host.code);
  const v = rooms.view(room, late.playerId, T0);
  assert.equal(v.game.me, null);
  assert.match(rooms.action(host.code, late.token, { type: "chat", text: "hi" }, T0).error, /seated/);
});

test("reconnecting with the same token restores the same seat", () => {
  const { rooms, host, others } = setup(4);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  const room = rooms.rooms.get(host.code);
  const seatBefore = room.game.seats.find((s) => s.playerId === others[0].playerId).charId;
  let got = null;
  const off = rooms.connect(host.code, others[0].token, (b) => { got = JSON.parse(b); }, T0 + 1000);
  assert.equal(got.game.me.charId, seatBefore);
  off();
  assert.equal(rooms.connect(host.code, "not-a-token", () => {}, T0), null);
});

test("host can kick and mute; a kicked player's token stops working", () => {
  const { rooms, host, others, sent } = setup(4);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  assert.ok(rooms.action(host.code, host.token, { type: "mute", playerId: others[0].playerId }, T0).ok);
  assert.match(rooms.action(host.code, others[0].token, { type: "chat", text: "hi" }, T0 + 5).error, /muted/);
  const room = rooms.rooms.get(host.code);
  const victim = room.game.seats.find((s) => s.role !== "culprit" && s.playerId !== host.playerId);
  const token = [host, ...others].find((p) => p.playerId === victim.playerId).token;
  assert.ok(rooms.action(host.code, host.token, { type: "kick", playerId: victim.playerId }, T0).ok);
  assert.deepEqual(sent[victim.playerId].at(-1), { removed: "kicked" });
  assert.match(rooms.action(host.code, token, { type: "chat", text: "back" }, T0).error, /expired/);
  assert.ok(room.game.npcs.includes(victim.charId));
});

test("the host role passes on after the host has been gone for 30 seconds", () => {
  const { rooms, host, others } = setup(3);
  const room = rooms.rooms.get(host.code);
  const hostPerson = room.people.find((p) => p.id === host.playerId);
  hostPerson.connected = false;
  hostPerson.lastSeen = T0;
  rooms.tickAll(T0 + 10_000);
  assert.equal(room.hostId, host.playerId);
  rooms.tickAll(T0 + 31_000);
  assert.equal(room.hostId, others[0].playerId);
});

test("scores carry across a rematch, and the culprit rotates", () => {
  const { rooms, host } = setup(4);
  const room = rooms.rooms.get(host.code);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  const firstCulprit = room.game.seats.find((s) => s.role === "culprit").playerId;
  let now = T0;
  while (room.game.phase !== "resolution") { now = room.game.endsAt; rooms.tickAll(now); }
  assert.ok(Object.keys(room.scores).length > 0);
  const total = Object.values(room.scores).reduce((a, b) => a + b, 0);
  assert.ok(rooms.action(host.code, host.token, { type: "rematch" }, now).ok);
  assert.equal(room.game, null);
  rooms.action(host.code, host.token, { type: "start" }, now);
  assert.notEqual(room.game.seats.find((s) => s.role === "culprit").playerId, firstCulprit);
  assert.equal(Object.values(room.scores).reduce((a, b) => a + b, 0), total);
});

test("reports are recorded with the reported player's recent chat", () => {
  const { rooms, host, others, reports } = setup(4);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  rooms.action(host.code, others[0].token, { type: "chat", text: "something rude" }, T0);
  const r = rooms.action(host.code, host.token, { type: "report", playerId: others[0].playerId, reason: "Harassment" }, T0);
  assert.ok(r.ok);
  assert.equal(reports[0].reported, "Player 1");
  assert.deepEqual(reports[0].recentChat, ["something rude"]);
  assert.match(rooms.action(host.code, host.token, { type: "report", playerId: host.playerId }, T0).error, /someone/);
});

test("public rooms are listed only while in the lobby", () => {
  const { rooms, host } = setup(4);
  assert.equal(rooms.publicRooms().length, 0);
  rooms.action(host.code, host.token, { type: "setSettings", isPublic: true }, T0);
  assert.equal(rooms.publicRooms().length, 1);
  rooms.action(host.code, host.token, { type: "start" }, T0);
  assert.equal(rooms.publicRooms().length, 0);
});
