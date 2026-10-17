// Rooms: codes, joining, reconnection, host powers, moderation, and per-player views.
// A room owns at most one game at a time; scores carry across rematches.
import { randomBytes, randomInt } from "node:crypto";
import { materialize, variantIds, publicMeta } from "./scenario.js";
import { createGame, act, tick, viewFor, leave, extend, PACE } from "./game.js";
import { cleanName, cleanChat } from "./text.js";

const CODE_CHARS = "BCDFGHJKLMNPQRSTVWXZ"; // no vowels, so codes can't spell words
const MAX_PEOPLE = 12;
const HOST_GRACE_MS = 30_000;
const LOBBY_DROP_MS = 120_000;
const ROOM_IDLE_MS = 30 * 60_000;

const id = (n = 8) => randomBytes(n).toString("hex");

export class Rooms {
  constructor(scenarios, { onReport = () => {} } = {}) {
    this.scenarios = new Map(scenarios.map((s) => [s.id, s]));
    this.rooms = new Map();
    this.listeners = new Map(); // code -> Set<{ playerId, send, last }>
    this.onReport = onReport;
  }

  scenarioList() {
    return [...this.scenarios.values()].map(publicMeta);
  }

  newCode() {
    for (;;) {
      const code = Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
      if (!this.rooms.has(code)) return code;
    }
  }

  create(rawName, { isPublic = false } = {}, now = Date.now()) {
    const n = cleanName(rawName);
    if (n.error) return n;
    const code = this.newCode();
    const host = this.person(n.name, now);
    const room = {
      code, hostId: host.id, isPublic: !!isPublic, createdAt: now, lastActive: now,
      people: [host], scenarioId: [...this.scenarios.keys()][0], variant: "random",
      settings: { pace: "standard", scoring: true }, game: null, scores: {}, lastCulprit: null, version: 0,
    };
    this.rooms.set(code, room);
    return { code, token: host.token, playerId: host.id };
  }

  person(name, now, extra = {}) {
    return { id: id(6), token: id(16), name, bot: false, connected: false, lastSeen: now, spectator: false, ready: false, ...extra };
  }

  uniqueName(room, name) {
    let n = name, i = 2;
    while (room.people.some((p) => p.name.toLowerCase() === n.toLowerCase())) n = `${name} ${i++}`;
    return n;
  }

  join(code, rawName, now = Date.now()) {
    const room = this.rooms.get(String(code).toUpperCase());
    if (!room) return { error: "No room with that code." };
    const n = cleanName(rawName);
    if (n.error) return n;
    if (room.people.length >= MAX_PEOPLE) return { error: "This room is full." };
    const inGame = room.game && room.game.phase !== "resolution";
    const p = this.person(this.uniqueName(room, n.name), now, { spectator: !!inGame });
    room.people.push(p);
    this.bump(room, now);
    return { code: room.code, token: p.token, playerId: p.id, spectator: p.spectator };
  }

  find(code, token) {
    const room = this.rooms.get(String(code ?? "").toUpperCase());
    const p = room?.people.find((x) => x.token === token);
    return p ? { room, p } : null;
  }

  publicRooms() {
    return [...this.rooms.values()].filter((r) => r.isPublic && !r.game).map((r) => ({
      code: r.code, host: r.people.find((p) => p.id === r.hostId)?.name ?? "", players: r.people.filter((p) => !p.spectator).length,
      scenario: this.scenarios.get(r.scenarioId)?.title ?? "",
    }));
  }

  connect(code, token, send, now = Date.now()) {
    const found = this.find(code, token);
    if (!found) return null;
    const { room, p } = found;
    const l = { playerId: p.id, send, last: "" };
    if (!this.listeners.has(room.code)) this.listeners.set(room.code, new Set());
    this.listeners.get(room.code).add(l);
    p.connected = true;
    p.lastSeen = now;
    if (room.game) room.game.connected[p.id] = true;
    this.bump(room, now);
    return () => {
      this.listeners.get(room.code)?.delete(l);
      const still = [...(this.listeners.get(room.code) ?? [])].some((x) => x.playerId === p.id);
      if (!still) {
        p.connected = false;
        p.lastSeen = Date.now();
        if (room.game) room.game.connected[p.id] = false;
        this.bump(room, Date.now());
      }
    };
  }

  bump(room, now) {
    room.version++;
    room.lastActive = now;
    this.collectScores(room);
    this.notify(room, now);
  }

  notify(room, now = Date.now()) {
    for (const l of this.listeners.get(room.code) ?? []) {
      const body = JSON.stringify(this.view(room, l.playerId, now));
      const comparable = body.replace(/"serverNow":\d+/, "");
      if (comparable !== l.last) {
        l.last = comparable;
        l.send(body);
      }
    }
  }

  view(room, playerId, now) {
    const me = room.people.find((p) => p.id === playerId);
    return {
      serverNow: now, code: room.code, isPublic: room.isPublic, hostId: room.hostId,
      me: me ? { id: me.id, name: me.name, isHost: me.id === room.hostId, spectator: me.spectator } : null,
      people: room.people.map((p) => ({ id: p.id, name: p.name, bot: p.bot, connected: p.bot || p.connected, spectator: p.spectator, ready: p.ready })),
      scenarioId: room.scenarioId, variant: room.variant, settings: room.settings, scores: room.scores,
      scenarios: this.scenarioList(),
      game: room.game ? viewFor(room.game, playerId, now) : null,
    };
  }

  collectScores(room) {
    const g = room.game;
    if (!g || g.phase !== "resolution" || g.scoresCollected) return;
    g.scoresCollected = true;
    for (const [pid, pts] of Object.entries(g.result.points ?? {})) room.scores[pid] = (room.scores[pid] ?? 0) + pts.total;
  }

  action(code, token, a, now = Date.now()) {
    const found = this.find(code, token);
    if (!found) return { error: "Your session has expired. Join again." };
    const { room, p } = found;
    const isHost = p.id === room.hostId;
    const lobby = !room.game || room.game.phase === "resolution";
    const hostOnly = () => (isHost ? null : { error: "Only the host can do that." });
    p.lastSeen = now;
    let r;
    switch (a?.type) {
      case "lobbyReady":
        p.ready = !p.ready;
        r = { ok: true };
        break;
      case "setScenario": {
        r = hostOnly() ?? (!lobby ? { error: "Finish this case first." } : null);
        if (r) break;
        const s = this.scenarios.get(a.scenarioId);
        if (!s) { r = { error: "Unknown scenario." }; break; }
        const v = a.variant ?? "random";
        if (v !== "random" && !variantIds(s).includes(v)) { r = { error: "Unknown variant." }; break; }
        room.scenarioId = s.id;
        room.variant = v;
        r = { ok: true };
        break;
      }
      case "setSettings":
        r = hostOnly() ?? (!lobby ? { error: "Finish this case first." } : null);
        if (r) break;
        if (a.pace && PACE[a.pace]) room.settings.pace = a.pace;
        if (typeof a.scoring === "boolean") room.settings.scoring = a.scoring;
        if (typeof a.isPublic === "boolean") room.isPublic = a.isPublic;
        r = { ok: true };
        break;
      case "addBot": {
        r = hostOnly() ?? (!lobby ? { error: "Add practice bots in the lobby." } : null);
        if (r) break;
        if (room.people.filter((x) => !x.spectator).length >= 6) { r = { error: "The table is full." }; break; }
        const n = room.people.filter((x) => x.bot).length + 1;
        room.people.push(this.person(`Practice bot ${n}`, now, { bot: true, connected: true, ready: true }));
        r = { ok: true };
        break;
      }
      case "kick": {
        r = hostOnly();
        if (r) break;
        const target = room.people.find((x) => x.id === a.playerId);
        if (!target || target.id === p.id) { r = { error: "You can't remove that player." }; break; }
        this.remove(room, target, now, "kicked");
        r = { ok: true };
        break;
      }
      case "mute": {
        r = hostOnly() ?? (!room.game ? { error: "Muting applies during a game." } : null);
        if (r) break;
        const m = room.game.muted;
        room.game.muted = m.includes(a.playerId) ? m.filter((x) => x !== a.playerId) : [...m, a.playerId];
        room.game.version++;
        r = { ok: true };
        break;
      }
      case "transferHost": {
        r = hostOnly();
        if (r) break;
        const target = room.people.find((x) => x.id === a.playerId && !x.bot);
        if (!target) { r = { error: "Choose a human player." }; break; }
        room.hostId = target.id;
        r = { ok: true };
        break;
      }
      case "start":
        r = hostOnly() ?? (!lobby ? { error: "A case is already running." } : null) ?? this.start(room, now);
        break;
      case "rematch":
        r = hostOnly() ?? (room.game?.phase !== "resolution" ? { error: "Finish this case first." } : null);
        if (r) break;
        room.game = null;
        for (const x of room.people) { x.spectator = false; x.ready = x.bot; }
        r = { ok: true };
        break;
      case "extend":
        r = hostOnly() ?? (!room.game ? { error: "No case is running." } : extend(room.game, now));
        break;
      case "leave":
        this.remove(room, p, now, "left");
        r = { ok: true };
        break;
      case "report": {
        const target = room.people.find((x) => x.id === a.playerId);
        if (!target || target.id === p.id) { r = { error: "Choose someone to report." }; break; }
        const reason = cleanChat(a.reason ?? "", 500);
        this.onReport({ at: new Date(now).toISOString(), room: room.code, reporter: p.name, reported: target.name, reason: reason.text ?? "",
          recentChat: (room.game?.chat ?? []).filter((m) => m.by === target.id).slice(-10).map((m) => m.text) });
        r = { ok: true, message: "Thanks. The report has been recorded." };
        break;
      }
      default: {
        if (!room.game) { r = { error: "No case is running." }; break; }
        if (a?.type === "chat") {
          const c = cleanChat(a.text, 300);
          if (c.error) { r = c; break; }
          a = { ...a, text: c.text };
        }
        r = act(room.game, p.id, a, now);
      }
    }
    if (r?.ok) this.bump(room, now);
    return r ?? { error: "Something went wrong." };
  }

  start(room, now) {
    const players = room.people.filter((x) => !x.spectator);
    const base = this.scenarios.get(room.scenarioId);
    if (players.length < base.players.min || players.length > base.players.max) {
      return { error: `${base.title} needs ${base.players.min}–${base.players.max} players. Add practice bots to fill seats.` };
    }
    const variants = variantIds(base);
    const variant = room.variant === "random" ? variants[randomInt(variants.length)] : room.variant;
    room.game = createGame({
      scenario: materialize(base, variant), players: players.map((x) => ({ id: x.id, name: x.name, bot: x.bot })),
      seed: randomInt(2 ** 31), settings: room.settings, now, avoidCulprit: room.lastCulprit,
    });
    for (const x of players) room.game.connected[x.id] = x.bot || x.connected;
    room.lastCulprit = room.game.seats.find((x) => x.role === "culprit").playerId;
    for (const x of room.people) x.ready = x.bot;
    return { ok: true };
  }

  remove(room, person, now, reason) {
    if (room.game && room.game.phase !== "resolution" && !person.spectator) leave(room.game, person.id, now, reason);
    room.people = room.people.filter((x) => x !== person);
    for (const l of [...(this.listeners.get(room.code) ?? [])]) {
      if (l.playerId === person.id) { l.send(JSON.stringify({ removed: reason })); this.listeners.get(room.code).delete(l); }
    }
    if (room.hostId === person.id) this.passHost(room);
    if (!room.people.some((x) => !x.bot)) this.rooms.delete(room.code);
    else this.bump(room, now);
  }

  passHost(room) {
    const next = room.people.find((x) => !x.bot && x.connected) ?? room.people.find((x) => !x.bot);
    if (next) room.hostId = next.id;
  }

  /** Called every second: phase timers, host failover, dropping stale lobby players, idle rooms. */
  tickAll(now = Date.now()) {
    for (const room of [...this.rooms.values()]) {
      let changed = room.game ? tick(room.game, now) : false;
      const host = room.people.find((x) => x.id === room.hostId);
      if (host && !host.connected && now - host.lastSeen > HOST_GRACE_MS && room.people.some((x) => !x.bot && x.connected)) {
        this.passHost(room);
        changed = true;
      }
      if (!room.game || room.game.phase === "resolution") {
        for (const x of room.people.filter((y) => !y.bot && !y.connected && now - y.lastSeen > LOBBY_DROP_MS)) {
          if (this.rooms.has(room.code)) this.remove(room, x, now, "left");
        }
      }
      if (!room.people.some((x) => !x.bot && x.connected) && now - room.lastActive > ROOM_IDLE_MS) {
        this.rooms.delete(room.code);
        this.listeners.delete(room.code);
        continue;
      }
      if (changed && this.rooms.has(room.code)) this.bump(room, now);
    }
  }
}
