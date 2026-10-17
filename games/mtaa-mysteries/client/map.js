// The walkable map: one persistent canvas plus its own controls, so app re-renders don't reset it.
// You move locally at once (prediction); the server checks every step and snaps you back if needed.
// Other walkers arrive over the "pos" stream, filtered by the server to your sight radius.
import { SPEED, REACH, slide, findPath, parseMap, tileAt } from "./geom.js";

const MOVABLE = ["discovery", "investigate1", "investigate2", "arguments"];
const SEND_EVERY_MS = 100;
const PLAYER_COLOURS = ["#e4572e", "#2e86ab", "#7b9e3c", "#a23b72", "#f0a202", "#3d5a80", "#6c4f3d", "#2a9d8f"];

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
};

export class MapView {
  constructor({ send, act, toast, announce }) {
    this.send = send; this.act = act; this.toast = toast; this.announce = announce;
    this.canvas = el("canvas", { class: "map-canvas", tabindex: "0", role: "img", "aria-label": "Map of the scene. Use the arrow keys or WASD to walk, E to act, or tap where you want to go." });
    this.status = el("p", { class: "map-status", "aria-live": "polite" });
    this.button = el("button", { class: "btn teal", type: "button", onClick: () => this.primary() }, "Search here");
    this.walkTo = el("select", { "aria-label": "Walk to a place", onChange: (e) => { this.goToPlace(e.target.value); e.target.value = ""; } });
    this.el = el("div", { class: "mapwrap" }, this.canvas,
      el("div", { class: "map-controls" }, this.button, this.walkTo, el("span", { class: "small muted map-help" }, "Arrows/WASD to walk · E to act · or tap the map")),
      this.status);
    this.keys = new Set();
    this.others = new Map(); // id -> { x, y, tx, ty, charId, busy }
    this.me = null; // { x, y }
    this.path = null;
    this.lastSent = { x: 0, y: 0, at: 0 };
    this.pending = false;
    this.errand = null; // { index, startedAt, seconds, x, y, finishing }
    this.lastStatus = "";
    this.bindInput();
    requestAnimationFrame((t) => this.frame(t, t));
  }

  /** Called with every new view from the server. */
  setGame(game, myId) {
    if (!game?.scenario.map) { this.game = null; return; }
    if (this.scenarioKey !== game.scenario.id + game.seats.map((s) => s.playerId).join()) {
      this.scenarioKey = game.scenario.id + game.seats.map((s) => s.playerId).join();
      this.parsed = parseMap(game.scenario.map);
      this.me = null; this.others.clear(); this.path = null; this.errand = null;
      this.walkTo.replaceChildren(el("option", { value: "" }, "Walk to…"), ...game.scenario.places.map((p) => el("option", { value: p.id }, p.name)));
    }
    this.game = game;
    this.myId = myId;
    this.colour = Object.fromEntries(game.seats.map((s, i) => [s.playerId, PLAYER_COLOURS[i % PLAYER_COLOURS.length]]));
    if (!MOVABLE.includes(game.phase)) { this.keys.clear(); this.path = null; }
    if (game.me?.errands?.active === null && this.errand && !this.errand.finishing) this.errand = null;
  }

  /** Called with each "pos" event: me (server's copy) and the walkers I can see. */
  setPositions(data) {
    if (!data) return;
    if (data.me && !this.me) this.me = { ...data.me };
    const seen = new Set();
    for (const o of data.others) {
      seen.add(o.id);
      const cur = this.others.get(o.id);
      if (cur) Object.assign(cur, { tx: o.x, ty: o.y, busy: o.busy, charId: o.charId });
      else this.others.set(o.id, { x: o.x, y: o.y, tx: o.x, ty: o.y, busy: o.busy, charId: o.charId });
    }
    for (const id of [...this.others.keys()]) if (!seen.has(id)) this.others.delete(id);
    this.serverOffset = data.now - Date.now();
  }

  // ---- Input
  bindInput() {
    const keyMap = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    window.addEventListener("keydown", (e) => {
      if (!this.active() || typing(e)) return;
      if (keyMap[e.code]) { this.keys.add(keyMap[e.code]); this.path = null; e.preventDefault(); }
      if (e.code === "KeyE" || (e.code === "Enter" && e.target === this.canvas)) { this.primary(); e.preventDefault(); }
    });
    window.addEventListener("keyup", (e) => { if (keyMap[e.code]) this.keys.delete(keyMap[e.code]); });
    window.addEventListener("blur", () => this.keys.clear());
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.active() || !this.me) return;
      const r = this.canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / this.ts + this.camX, y = (e.clientY - r.top) / this.ts + this.camY;
      this.path = findPath(this.parsed.rows, this.me.x, this.me.y, x, y);
      if (this.path?.length) this.path[this.path.length - 1] = [Math.floor(x) + 0.5, Math.floor(y) + 0.5];
    });
  }

  active() { return !!this.game && !!this.game.me && MOVABLE.includes(this.game.phase) && this.el.isConnected; }

  goToPlace(placeId) {
    if (!placeId || !this.me) return;
    const spot = this.game.scenario.map.spots.find((s) => s.place === placeId && s.open);
    const target = spot ?? (() => { const l = this.parsed.labels[placeId]; return { x: l.x, y: l.y }; })();
    let [tx, ty] = [target.x, target.y];
    if (!/[A-Za-z]/.test(tileAt(this.parsed.rows, tx, ty) ?? "")) [tx, ty] = this.parsed.floors[placeId][0].map((n) => n + 0.5);
    this.path = findPath(this.parsed.rows, this.me.x, this.me.y, tx, ty);
    this.canvas.focus({ preventScroll: true });
  }

  // ---- What can I do here?
  nearby() {
    if (!this.me || !this.game) return {};
    const map = this.game.scenario.map;
    const d = (p) => Math.hypot(p.x - this.me.x, p.y - this.me.y);
    const spot = map.spots.filter((s) => s.open && d(s) <= REACH).sort((a, b) => d(a) - d(b))[0];
    const done = this.game.me?.errands?.done ?? [];
    const errand = map.errands.filter((e) => !done.includes(e.index) && d(e) <= REACH).sort((a, b) => d(a) - d(b))[0];
    return { spot, errand, place: this.parsed.placeAtTile(this.me.x, this.me.y) };
  }

  async primary() {
    if (!this.active()) return;
    await this.flush(); // the server must know you've arrived before it lets you search
    const { spot, errand } = this.nearby();
    const inv = ["investigate1", "investigate2"].includes(this.game.phase);
    if (inv && spot && this.game.me.searchesLeft > 0) {
      const quiet = !!document.getElementById("quiet-search")?.checked;
      const r = await this.act("search", { quiet: quiet || undefined });
      if (r?.ok) this.toast(this.game.me.role === "detective" ? "Found something. It's on the board, verified." : "Found something. It's in your hand on your card.");
      return;
    }
    if (inv && errand && !this.errand) {
      const def = this.game.scenario.map.errands.find((e) => e.index === errand.index);
      const r = await this.act("errandStart", { index: errand.index });
      if (r?.ok) this.errand = { index: errand.index, startedAt: performance.now(), seconds: def.seconds, x: this.me.x, y: this.me.y, label: def.label };
    }
  }

  async tickErrand(now) {
    const e = this.errand;
    if (!e || e.finishing) return;
    if (Math.hypot(this.me.x - e.x, this.me.y - e.y) > 0.4) { this.errand = null; this.toast("Errand abandoned: you walked away."); return; }
    if (now - e.startedAt >= e.seconds * 1000) {
      e.finishing = true;
      const r = await this.act("errandFinish");
      this.errand = null;
      if (r?.ok) this.toast(r.bonus ? `Done: ${e.label}. That's two errands: +1 search this round!` : `Done: ${e.label}.`);
    }
  }

  // ---- Loop
  frame(t, last) {
    const dt = Math.min(0.1, (t - last) / 1000);
    if (this.game && this.el.isConnected) {
      if (this.active() && this.me && !this.errand) this.walk(dt);
      for (const o of this.others.values()) { const k = Math.min(1, dt * 10); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; }
      if (this.active() && this.me) { this.sync(t); this.tickErrand(t); }
      this.draw(t);
      this.updateControls();
    }
    requestAnimationFrame((n) => this.frame(n, t));
  }

  walk(dt) {
    let dx = 0, dy = 0;
    if (this.keys.size) {
      dx = (this.keys.has("right") ? 1 : 0) - (this.keys.has("left") ? 1 : 0);
      dy = (this.keys.has("down") ? 1 : 0) - (this.keys.has("up") ? 1 : 0);
    } else if (this.path?.length) {
      const [tx, ty] = this.path[0];
      const d = Math.hypot(tx - this.me.x, ty - this.me.y);
      if (d < 0.08) { this.path.shift(); return; }
      dx = (tx - this.me.x) / d; dy = (ty - this.me.y) / d;
      const stepLen = Math.min(d, SPEED * dt);
      [this.me.x, this.me.y] = slide(this.parsed.rows, this.me.x, this.me.y, dx * stepLen, dy * stepLen);
      return;
    }
    if (!dx && !dy) return;
    const len = Math.hypot(dx, dy);
    [this.me.x, this.me.y] = slide(this.parsed.rows, this.me.x, this.me.y, (dx / len) * SPEED * dt, (dy / len) * SPEED * dt);
  }

  async sync(t, force = false) {
    if (this.pending || (!force && t - this.lastSent.at < SEND_EVERY_MS)) return this.pending;
    const { x, y } = this.me;
    if (Math.hypot(x - this.lastSent.x, y - this.lastSent.y) < 0.02) return null;
    this.lastSent = { x, y, at: t };
    this.pending = (async () => {
      try {
        const r = await this.send(x, y);
        if (r && !r.ok && Number.isFinite(r.x)) { this.me = { x: r.x, y: r.y }; this.path = null; this.lastSent = { x: r.x, y: r.y, at: t }; }
      } finally { this.pending = false; }
    })();
    return this.pending;
  }

  /** Waits for any report in flight, then sends where you are now. */
  async flush() {
    if (!this.me) return;
    if (this.pending) await this.pending;
    await this.sync(performance.now(), true);
  }

  // ---- Drawing
  draw(t) {
    const c = this.canvas, ctx = c.getContext("2d");
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    const W = c.clientWidth, H = c.clientHeight, dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = this.parsed, map = this.game.scenario.map;
    const fit = Math.min(W / m.width, H / m.height);
    this.ts = Math.max(fit, Math.min(28, W / (W < 500 ? 12 : 20))); // phones: bigger tiles to tap; desktop: see more
    const ts = this.ts;
    const focus = this.me ?? { x: m.width / 2, y: m.height / 2 };
    this.camX = fit >= this.ts ? (m.width - W / ts) / 2 : Math.max(0, Math.min(m.width - W / ts, focus.x - W / ts / 2));
    this.camY = fit >= this.ts ? (m.height - H / ts) / 2 : Math.max(0, Math.min(m.height - H / ts, focus.y - H / ts / 2));
    const sx = (x) => (x - this.camX) * ts, sy = (y) => (y - this.camY) * ts;
    c.dataset.camera = `${this.camX.toFixed(3)},${this.camY.toFixed(3)},${ts.toFixed(3)}`; // read by the browser tests

    ctx.fillStyle = v("--map-void"); ctx.fillRect(0, 0, W, H);
    const placeIds = this.game.scenario.places.map((p) => p.id);
    const floorColour = (pid) => v(`--map-floor-${placeIds.indexOf(pid) % 8}`);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const ch = m.rows[y][x];
        if (ch === " " || ch === undefined) continue;
        ctx.fillStyle = ch === "#" ? v("--map-wall") : ch === "." || ch === ":" ? v("--map-path") : floorColour(m.placeAtTile(x, y));
        ctx.fillRect(Math.floor(sx(x)), Math.floor(sy(y)), Math.ceil(ts) + 1, Math.ceil(ts) + 1);
      }
    }
    // Place names
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.max(10, ts * 0.42)}px system-ui, sans-serif`;
    for (const p of this.game.scenario.places) {
      const l = m.labels[p.id];
      const locked = p.restricted && this.game.phase !== "investigate2" && this.game.me?.role !== "insider";
      ctx.fillStyle = v("--map-label");
      const short = p.name.replace(/\s*\(.*\)$/, "").split(",")[0]; // full names are in the menu and status line
      ctx.fillText(short + (locked ? " 🔒" : ""), sx(l.x), sy(l.y) - ts * 0.9);
    }
    // Clue spots and errands
    const pulse = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.75 + 0.25 * Math.sin(t / 250);
    for (const s of map.spots) {
      ctx.beginPath();
      ctx.arc(sx(s.x), sy(s.y), ts * (s.open ? 0.28 * pulse + 0.06 : 0.14), 0, Math.PI * 2);
      ctx.fillStyle = s.open ? v("--map-spot") : v("--map-spent");
      ctx.fill();
    }
    const done = this.game.me?.errands?.done ?? [];
    ctx.font = `700 ${Math.max(10, ts * 0.45)}px system-ui, sans-serif`;
    for (const e of map.errands) {
      ctx.beginPath(); ctx.arc(sx(e.x), sy(e.y), ts * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = done.includes(e.index) ? v("--map-spent") : v("--map-errand"); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(done.includes(e.index) ? "✓" : "!", sx(e.x), sy(e.y) + 1);
    }
    // Walkers
    const seats = this.game.seats;
    const nameOf = (pid) => seats.find((s) => s.playerId === pid)?.name ?? "";
    const drawWalker = (pid, x, y, busy, isMe) => {
      ctx.beginPath(); ctx.arc(sx(x), sy(y), ts * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = this.colour[pid] ?? "#888"; ctx.fill();
      ctx.lineWidth = isMe ? 3 : 1.5; ctx.strokeStyle = isMe ? v("--ink") : "rgba(0,0,0,.35)"; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.max(9, ts * 0.38)}px system-ui, sans-serif`;
      ctx.fillText(nameOf(pid).slice(0, 1).toUpperCase(), sx(x), sy(y) + 1);
      ctx.fillStyle = v("--ink"); ctx.font = `600 ${Math.max(9, ts * 0.34)}px system-ui, sans-serif`;
      ctx.fillText(isMe ? "You" : nameOf(pid), sx(x), sy(y) + ts * 0.7);
      if (busy) {
        const frac = Math.min(1, busy);
        ctx.beginPath(); ctx.arc(sx(x), sy(y), ts * 0.5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.strokeStyle = v("--map-errand"); ctx.lineWidth = 3; ctx.stroke();
      }
    };
    const serverNow = Date.now() + (this.serverOffset ?? 0);
    for (const [id, o] of this.others) drawWalker(id, o.x, o.y, o.busy ? (serverNow - o.busy.started) / (o.busy.seconds * 1000) : 0, false);
    if (this.me && this.game.me) drawWalker(this.myId, this.me.x, this.me.y, this.errand ? (t - this.errand.startedAt) / (this.errand.seconds * 1000) : 0, true);
    // Sight: everything outside your radius is dim (the server doesn't send walkers out there anyway).
    if (this.me && this.game.me) {
      ctx.beginPath(); ctx.rect(0, 0, W, H);
      ctx.arc(sx(this.me.x), sy(this.me.y), map.vision * ts, 0, Math.PI * 2, true);
      ctx.fillStyle = v("--map-dark"); ctx.fill("evenodd");
    }
  }

  updateControls() {
    const g = this.game;
    const { spot, errand, place } = this.nearby();
    const inv = ["investigate1", "investigate2"].includes(g.phase);
    let label = null;
    if (!g.me) label = null;
    else if (inv && spot && g.me.searchesLeft > 0) label = "Search here (E)";
    else if (inv && errand && !this.errand) label = `${g.scenario.map.errands.find((e) => e.index === errand.index).label} (E)`;
    this.button.hidden = !label;
    if (label && this.button.textContent !== label) this.button.textContent = label;
    const placeName = g.scenario.places.find((p) => p.id === place)?.name;
    const done = g.me?.errands?.done.length ?? 0;
    let text = !g.me ? "You're watching. Walkers are hidden from spectators."
      : !MOVABLE.includes(g.phase) ? "The map opens when the case does."
      : `${placeName ? `You're in: ${placeName}.` : "You're on a path."}`
        + (inv ? ` ${g.me.searchesLeft} search${g.me.searchesLeft === 1 ? "" : "es"} left. Errands this round: ${done}/${g.me.errands?.forBonus ?? 2} for a bonus search.` : "")
        + (this.errand ? ` Doing: ${this.errand.label}…` : "")
        + (inv && spot && g.me.searchesLeft < 1 ? " A clue spot is here, but you have no searches left." : "");
    if (text !== this.lastStatus) { this.lastStatus = text; this.status.textContent = text; }
  }
}
