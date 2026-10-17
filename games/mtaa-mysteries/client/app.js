// Mtaa Mysteries client. Everything the server sends is rendered with text nodes only.
// The server decides what each player may see; this file only displays it.

import { MapView } from "./map.js";

const app = document.getElementById("app");
const live = document.getElementById("live");
const toastEl = document.getElementById("toast");

// ---- Storage (per-viewer conveniences only; the game never depends on it)
const store = {
  get(k, d) { try { const v = localStorage.getItem("mtaa:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("mtaa:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem("mtaa:" + k); } catch { /* private mode */ } },
};
const prefs = { gloss: store.get("gloss", "inline"), theme: store.get("theme", "auto"), size: store.get("size", "normal") };
function applyPrefs() {
  if (prefs.theme === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = prefs.theme;
  if (prefs.size === "large") document.documentElement.dataset.size = "large"; else delete document.documentElement.dataset.size;
}
applyPrefs();

let session = null; // { code, token, playerId }
let view = null;
let es = null;
let offset = 0;
let conn = "idle";
let lastPhase = null;
const ui = { tab: "board", filter: "all", overlay: store.get("seenTutorial", false) ? null : "tutorial", hideCard: false,
  voteTarget: null, voteClue: "", accuseTarget: "", accuseClue: "", confirm: null, reportFor: null, quiet: false, menuFor: null, publicRooms: [] };
const drafts = {};

// ---- DOM helper
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v; // CSSOM, so the strict CSP still allows it
    else if (k === "text") el.textContent = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Turns "[[chama|savings group]]" into the reader's chosen glossary style. */
function gloss(text) {
  const out = [];
  const re = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;
  let last = 0, m;
  while ((m = re.exec(text ?? ""))) {
    out.push(text.slice(last, m.index));
    if (prefs.gloss === "hover") out.push(h("abbr", { class: "gloss", title: m[2], tabindex: 0 }, m[1]));
    else if (prefs.gloss === "inline") out.push(m[1], h("span", { class: "gloss-inline" }, ` (${m[2]})`));
    else out.push(m[1]);
    last = m.index + m[0].length;
  }
  out.push((text ?? "").slice(last));
  return out;
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => (toastEl.hidden = true), 3200);
}
const announce = (t) => { live.textContent = t; };

// ---- The walkable map (one persistent instance; see map.js)
const mapView = new MapView({
  send: async (x, y) => {
    if (!session) return null;
    const r = await fetch(`/api/rooms/${session.code}/pos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: session.token, x, y }) });
    return r.json().catch(() => null);
  },
  act: async (type, extra) => {
    const r = await act(type, extra);
    if (type === "search" && r?.ok) { ui.quiet = false; render(); }
    return r;
  },
  toast: (t) => toast(t),
  announce: (t) => announce(t),
});
const MOVABLE = ["discovery", "investigate1", "investigate2", "arguments"];

// ---- Network
async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}
async function act(type, extra = {}) {
  try {
    const r = await api(`/api/rooms/${session.code}/act`, { token: session.token, type, ...extra });
    if (r.message) toast(r.message);
    return r;
  } catch (e) {
    toast(e.message);
    return null;
  }
}

function connect(code, token, playerId) {
  session = { code, token, playerId };
  store.set("session:" + code, { token, playerId });
  if (location.pathname !== "/" + code) history.pushState({}, "", "/" + code);
  es?.close();
  conn = "connecting";
  es = new EventSource(`/api/rooms/${code}/stream?token=${encodeURIComponent(token)}`);
  es.onopen = () => { conn = "live"; render(); };
  es.onerror = () => { conn = "reconnecting"; render(); };
  es.addEventListener("pos", (e) => mapView.setPositions(JSON.parse(e.data)));
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.removed) return dropSession(data.removed === "kicked" ? "The host removed you from the room." : data.removed === "unknown" ? "That room session has ended." : "You left the room.");
    view = data;
    offset = data.serverNow - Date.now();
    mapView.setGame(data.game, data.me?.id);
    const phase = data.game?.phase ?? "lobby";
    if (phase !== lastPhase) {
      announce(`${PHASE[phase]?.name ?? "Lobby"}. ${PHASE[phase]?.guide ?? ""}`);
      if (phase === "briefing") Object.assign(ui, { tab: "card", voteTarget: null, voteClue: "", accuseTarget: "", accuseClue: "", hideCard: false });
      if (phase === "vote") ui.tab = "act";
      lastPhase = phase;
    }
    render();
  };
}
function dropSession(message) {
  es?.close();
  if (session) store.del("session:" + session.code);
  session = null; view = null; lastPhase = null;
  history.pushState({}, "", "/");
  toast(message);
  render();
}

// ---- Copy for phases
const PHASE = {
  lobby: { name: "Lobby", guide: "" },
  briefing: { name: "Briefing", guide: "Read your card. Only you can see it. Press Ready when you're done." },
  discovery: { name: "Discovery", guide: "The case file is open. Read the starting clues and statements, and share what your character knows if you want to. Searching starts next." },
  investigate1: { name: "Investigation · round 1", guide: "Search one place (the Detective gets two). What you find is private until you share it. Anything unshared goes on the board automatically when the round ends." },
  investigate2: { name: "Investigation · round 2", guide: "One more search each. Restricted places are now open to everyone. Compare times and travel. Who can't account for the window?" },
  arguments: { name: "Closing arguments", guide: "Make one accusation: name a suspect, cite the clue that convinces you, and say why. Searching is over." },
  vote: { name: "The vote", guide: "Votes are secret and revealed together. The culprit is caught only with the most votes outright; a tie lets them escape." },
  resolution: { name: "The truth", guide: "" },
};

// ---- Helpers over the view
const g = () => view?.game;
const me = () => view?.game?.me;
const nameOfPlayer = (pid) => view.people.find((p) => p.id === pid)?.name ?? g()?.seats.find((s) => s.playerId === pid)?.name ?? "Someone";
const charName = (cid) => g()?.scenario.characters.find((c) => c.id === cid)?.name ?? cid;
const charOfPlayer = (pid) => g()?.seats.find((s) => s.playerId === pid)?.charId;
const isHost = () => view?.me?.isHost;
const seatedChars = () => g().seats.filter((s) => !s.left).map((s) => s.charId);
const boardClues = () => g().board.filter((b) => b.kind === "clue");
function remaining() {
  const ms = (g()?.endsAt ?? 0) - (Date.now() + offset);
  return Math.max(0, Math.ceil(ms / 1000));
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// ---- Render with focus, draft and scroll preservation
function render() {
  const active = document.activeElement;
  const focusId = active?.id || null;
  const sel = focusId && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  const scrolls = {};
  for (const el of app.querySelectorAll("[data-scroll]")) scrolls[el.dataset.scroll] = { top: el.scrollTop, atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 30 };
  app.replaceChildren(screen());
  for (const [id, value] of Object.entries(drafts)) { const el = document.getElementById(id); if (el && "value" in el) el.value = value; }
  for (const el of app.querySelectorAll("[data-scroll]")) {
    const s = scrolls[el.dataset.scroll];
    if (el.dataset.scroll === "chat" && (!s || s.atBottom)) el.scrollTop = el.scrollHeight;
    else if (s) el.scrollTop = s.top;
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch { /* not text */ } }
  }
}
const draft = (id) => ({ id, onInput: (e) => { drafts[id] = e.target.value; } });

function screen() {
  const parts = [];
  if (!session) parts.push(home());
  else if (!view) parts.push(h("div", { class: "wrap narrow pad" }, h("p", { class: "muted" }, "Connecting to room ", session.code, "…")));
  else if (!g()) parts.push(lobby());
  else parts.push(game());
  if (ui.overlay === "tutorial") parts.push(tutorial());
  if (ui.overlay === "settings") parts.push(settings());
  return h("div", {}, parts);
}

// ---- Home
function home() {
  const pathCode = /^\/([A-Za-z]{4})$/.exec(location.pathname)?.[1]?.toUpperCase();
  const create = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/rooms", { name: drafts["create-name"] ?? "", isPublic: !!document.getElementById("create-public")?.checked });
      store.set("name", drafts["create-name"]);
      connect(r.code, r.token, r.playerId);
    } catch (err) { toast(err.message); }
  };
  const join = async (e) => {
    e.preventDefault();
    const code = (drafts["join-code"] ?? pathCode ?? "").trim().toUpperCase();
    try {
      const r = await api(`/api/rooms/${code}/join`, { name: drafts["join-name"] ?? "" });
      store.set("name", drafts["join-name"]);
      if (r.spectator) toast("A case is in progress. You'll watch this one and play the next.");
      connect(r.code, r.token, r.playerId);
    } catch (err) { toast(err.message); }
  };
  drafts["create-name"] ??= store.get("name", "") ?? "";
  drafts["join-name"] ??= store.get("name", "") ?? "";
  if (pathCode) drafts["join-code"] ??= pathCode;
  return h("div", { class: "wrap" },
    h("header", { class: "hero" },
      h("div", { class: "row" }, h("span", { class: "badge accent" }, "Social deduction · 4–6 players · 20 minutes"),
        h("span", { class: "grow" }), h("button", { class: "link", onClick: () => { ui.overlay = "settings"; render(); } }, "Settings")),
      h("h1", {}, "Mtaa Mysteries"),
      h("p", { class: "tag" }, "Someone at this gathering is lying. Search for clues, test their alibis against the clock, and vote out the culprit before they slip away. Six cases set across Kenya.")),
    h("div", { class: "home-grid" },
      h("form", { class: "card stack", onSubmit: join },
        h("h2", {}, pathCode ? `Join room ${pathCode}` : "Join a room"),
        !pathCode && h("div", {}, h("label", { for: "join-code" }, "Room code"), h("input", { type: "text", class: "code-input", maxlength: 4, autocomplete: "off", inputmode: "text", ...draft("join-code"), "aria-describedby": "code-help" }),
          h("p", { class: "small muted", id: "code-help" }, "Four letters, from the host's screen.")),
        h("div", {}, h("label", { for: "join-name" }, "Your name"), h("input", { type: "text", maxlength: 20, autocomplete: "nickname", ...draft("join-name") })),
        h("button", { class: "btn primary block", type: "submit" }, "Join")),
      h("form", { class: "card stack", onSubmit: create },
        h("h2", {}, "Host a new room"),
        h("div", {}, h("label", { for: "create-name" }, "Your name"), h("input", { type: "text", maxlength: 20, autocomplete: "nickname", ...draft("create-name") })),
        h("label", { class: "check" }, h("input", { type: "checkbox", id: "create-public" }), "List this room publicly"),
        h("p", { class: "small muted" }, "Private rooms can only be joined with the code. You can add practice bots to fill seats."),
        h("button", { class: "btn teal block", type: "submit" }, "Create room")),
      h("div", { class: "card stack" },
        h("h2", {}, "New here?"),
        h("p", {}, "Each player becomes a character with a private card. One of you is the culprit, the only person allowed to lie. Everyone else can keep secrets, but can't say anything false."),
        h("button", { class: "btn block", onClick: () => { ui.overlay = "tutorial"; render(); } }, "How to play (2 minutes)"),
        publicRooms())));
}

function publicRooms() {
  const list = ui.publicRooms;
  return h("div", {},
    h("div", { class: "row" }, h("h3", { class: "grow" }, "Open rooms"), h("button", { class: "link", onClick: loadPublic }, "Refresh")),
    list.length ? h("ul", { class: "people" }, list.map((r) => h("li", {},
      h("span", { class: "grow" }, h("b", {}, r.scenario), h("br"), h("span", { class: "small muted" }, `Host ${r.host} · ${r.players} player${r.players === 1 ? "" : "s"}`)),
      h("a", { class: "btn small", href: "/" + r.code }, "Join ", r.code))))
      : h("p", { class: "small muted" }, "No public rooms right now. Host one, or ask a friend for their code."));
}
async function loadPublic() { try { ui.publicRooms = await api("/api/rooms"); render(); } catch { /* offline */ } }

// ---- Lobby
function lobby() {
  const v = view;
  const scen = v.scenarios.find((s) => s.id === v.scenarioId);
  const seated = v.people.filter((p) => !p.spectator);
  const link = `${location.origin}/${v.code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast("Link copied."); } catch { toast(link); } };
  return h("div", { class: "wrap" },
    h("div", { class: "row", style: "margin:8px 0 16px" }, h("h2", { class: "grow" }, "Lobby"),
      h("button", { class: "link", onClick: () => { ui.overlay = "tutorial"; render(); } }, "How to play"),
      h("button", { class: "link", onClick: () => { ui.overlay = "settings"; render(); } }, "Settings"),
      h("button", { class: "btn small danger", onClick: () => act("leave") }, "Leave")),
    h("div", { class: "lobby-grid" },
      h("div", { class: "stack" },
        h("section", { class: "card", "aria-label": "Room code" },
          h("p", { class: "small muted" }, "Room code"),
          h("div", { class: "room-code", "aria-label": v.code.split("").join(" ") }, v.code),
          h("div", { class: "row" }, h("button", { class: "btn small", onClick: copy }, "Copy invite link"), h("span", { class: "badge" }, v.isPublic ? "Public" : "Private"))),
        h("section", { class: "card" },
          h("h3", {}, `Players (${seated.length}/${scen?.players.max ?? 6})`),
          h("ul", { class: "people" }, v.people.map((p) => personRow(p))),
          isHost() && h("div", { class: "row" }, h("button", { class: "btn small", onClick: () => act("addBot"), disabled: seated.length >= 6 }, "Add practice bot")),
          !isHost() && h("button", { class: "btn block", onClick: () => act("lobbyReady") }, v.people.find((p) => p.id === v.me.id)?.ready ? "Not ready" : "I'm ready")),
        Object.keys(v.scores).length > 0 && scoreboard()),
      h("div", { class: "stack" },
        h("section", { class: "card stack" },
          h("h3", {}, isHost() ? "Choose a case" : "The case"),
          isHost()
            ? h("div", { class: "scen-grid" }, v.scenarios.map((s) => h("button", {
                class: "card flat scen", "aria-pressed": s.id === v.scenarioId ? "true" : "false",
                onClick: () => act("setScenario", { scenarioId: s.id, variant: "random" }) },
                h("h3", {}, s.title), h("p", { class: "small muted" }, s.location, " · ", s.minutes, " min · ", s.players.min, "–", s.players.max, " players"),
                h("p", { class: "small" }, s.teaser))))
            : scen && h("div", {}, h("h2", {}, scen.title), h("p", { class: "muted" }, scen.location, " · ", scen.tone), h("p", {}, scen.teaser)),
          scen?.contentNotes.length > 0 && h("p", { class: "small muted" }, "Content notes: ", scen.contentNotes.join("; "), ".")),
        isHost() && h("section", { class: "card stack" },
          h("h3", {}, "Settings"),
          h("div", {}, h("label", { for: "variant" }, "Version of the story"),
            h("select", { id: "variant", onChange: (e) => act("setScenario", { scenarioId: v.scenarioId, variant: e.target.value }) },
              h("option", { value: "random", selected: v.variant === "random" }, "Surprise me (recommended)"),
              Array.from({ length: scen?.variants ?? 1 }, (_, i) => String.fromCharCode(65 + i)).map((id) => h("option", { value: id, selected: v.variant === id }, `Version ${id}`))),
            h("p", { class: "small muted" }, "Versions change the culprit, motive or clue locations. A different player is the culprit each round.")),
          h("div", {}, h("label", { for: "pace" }, "Pace"),
            h("select", { id: "pace", onChange: (e) => act("setSettings", { pace: e.target.value }) },
              [["quick", "Quick (about 12 minutes)"], ["standard", "Standard (about 15 minutes)"], ["relaxed", "Relaxed (about 23 minutes, good for text-only groups)"]]
                .map(([id, label]) => h("option", { value: id, selected: v.settings.pace === id }, label)))),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: v.settings.map, onChange: (e) => act("setSettings", { map: e.target.checked }) }), "Walkable map (walk to places to search; turn off for the simpler list mode)"),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: v.settings.scoring, onChange: (e) => act("setSettings", { scoring: e.target.checked }) }), "Keep score"),
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: v.isPublic, onChange: (e) => act("setSettings", { isPublic: e.target.checked }) }), "List this room publicly"),
          h("button", { class: "btn primary block", onClick: () => act("start"),
            disabled: !scen || seated.length < scen.players.min || seated.length > scen.players.max },
            scen && seated.length < scen.players.min ? `Need ${scen.players.min - seated.length} more player${scen.players.min - seated.length > 1 ? "s" : ""} (or bots)` : "Start the case"),
          h("p", { class: "small muted" }, "Voice chat is optional. Everything can be done in the text chat.")))));
}

function personRow(p) {
  const v = view;
  const host = p.id === v.hostId;
  return h("li", {},
    h("span", { class: "dot" + (p.connected ? " on" : ""), "aria-hidden": "true" }),
    h("span", { class: "grow" }, p.name, p.id === v.me.id ? " (you)" : ""),
    host && h("span", { class: "badge accent" }, "Host"),
    p.bot && h("span", { class: "badge" }, "Bot"),
    p.spectator && h("span", { class: "badge" }, "Watching"),
    !g() && !host && !p.bot && h("span", { class: "badge " + (p.ready ? "good" : "") }, p.ready ? "Ready" : "Not ready"),
    !p.connected && h("span", { class: "sr-only" }, "(offline)"),
    p.id !== v.me.id && h("button", { class: "link small", "aria-expanded": ui.menuFor === p.id ? "true" : "false", onClick: () => { ui.menuFor = ui.menuFor === p.id ? null : p.id; render(); } }, "More"),
    ui.menuFor === p.id && h("div", { class: "row", style: "width:100%" },
      isHost() && !p.bot && h("button", { class: "btn small", onClick: () => act("transferHost", { playerId: p.id }) }, "Make host"),
      isHost() && g() && h("button", { class: "btn small", onClick: () => act("mute", { playerId: p.id }) }, g().seats.find((s) => s.playerId === p.id)?.muted ? "Unmute" : "Mute"),
      isHost() && h("button", { class: "btn small danger", onClick: () => { ui.confirm = { text: `Remove ${p.name} from the room?`, go: () => act("kick", { playerId: p.id }) }; render(); } }, "Remove"),
      !p.bot && h("button", { class: "btn small", onClick: () => { ui.reportFor = p.id; render(); } }, "Report")),
    ui.reportFor === p.id && reportForm(p),
    ui.confirm && ui.menuFor === p.id && confirmBox());
}

function reportForm(p) {
  return h("form", { class: "stack", style: "width:100%", onSubmit: async (e) => {
    e.preventDefault();
    const r = await act("report", { playerId: p.id, reason: drafts["report-reason"] ?? "" });
    if (r) { ui.reportFor = null; drafts["report-reason"] = ""; render(); }
  } },
    h("label", { for: "report-reason" }, `What did ${p.name} do?`),
    h("textarea", { maxlength: 500, ...draft("report-reason") }),
    h("div", { class: "row" }, h("button", { class: "btn small primary", type: "submit" }, "Send report"), h("button", { class: "btn small", type: "button", onClick: () => { ui.reportFor = null; render(); } }, "Cancel")));
}

function confirmBox() {
  const c = ui.confirm;
  return h("div", { class: "card flat stack", role: "alertdialog", "aria-label": c.text, style: "width:100%" }, h("p", {}, c.text),
    h("div", { class: "row" },
      h("button", { class: "btn small primary", onClick: () => { ui.confirm = null; c.go(); render(); } }, "Yes"),
      h("button", { class: "btn small", onClick: () => { ui.confirm = null; render(); } }, "Cancel")));
}

function scoreboard() {
  const rows = Object.entries(view.scores).sort((a, b) => b[1] - a[1]);
  return h("section", { class: "card" }, h("h3", {}, "Scores this session"),
    h("table", { class: "score" }, h("tbody", {}, rows.map(([pid, n]) => h("tr", {}, h("td", {}, nameOfPlayer(pid)), h("td", { class: "mono" }, n))))));
}

// ---- Game
function game() {
  const G = g();
  const phase = PHASE[G.phase];
  const myReady = G.seats.find((s) => s.playerId === view.me.id)?.ready;
  const humans = G.seats.filter((s) => !s.left && !s.bot && s.connected);
  const readyCount = humans.filter((s) => s.ready).length;
  const top = h("div", { class: "topbar" }, h("div", { class: "wrap" },
    h("div", { class: "row" },
      h("div", { class: "grow" },
        h("div", { class: "small muted" }, G.scenario.title, " · ", G.scenario.location),
        h("div", { class: "phase-name" }, phase.name)),
      G.phase !== "resolution" && h("div", { class: "timer", "data-timer": "1", "aria-label": "Time left in this phase" }, fmt(remaining())),
      conn !== "live" && h("span", { class: "badge bad conn" }, conn === "reconnecting" ? "Reconnecting…" : "Connecting…")),
    G.phase !== "resolution" && h("div", { class: "row", style: "margin-top:8px" },
      h("div", { class: "guide grow" }, phase.guide),
      me() && G.phase !== "vote" && h("button", { class: "btn small " + (myReady ? "" : "teal"), onClick: () => act(myReady ? "unready" : "ready") },
        myReady ? `Waiting (${readyCount}/${humans.length})` : `Ready (${readyCount}/${humans.length})`),
      isHost() && !G.extended && h("button", { class: "btn small", onClick: () => act("extend") }, "+1 min"),
      h("button", { class: "link small", onClick: () => { ui.overlay = "tutorial"; render(); } }, "Help"))));
  if (G.phase === "resolution") return h("div", {}, top, results());

  const panels = {
    card: me() ? cardPanel() : spectatorPanel(),
    case: casePanel(),
    act: [h("p", { class: "guide mobile-only" }, phase.guide), actPanel()],
    board: boardPanel(),
    chat: chatPanel(),
  };
  const unseen = { board: G.board.length > (ui.seenBoard ?? 0) && ui.tab !== "board", chat: G.chat.length > (ui.seenChat ?? 0) && ui.tab !== "chat" };
  if (ui.tab === "board") ui.seenBoard = G.board.length;
  if (ui.tab === "chat") ui.seenChat = G.chat.length;
  const panel = (key, label) => h("section", { class: "panel" + (ui.tab === key ? "" : " off"), id: "panel-" + key, role: "tabpanel", "aria-label": label }, panels[key]);
  const tabs = h("nav", { class: "tabs", role: "tablist", "aria-label": "Game sections" },
    [["card", "My card"], ["case", "Case"], ["act", "Act"], ["board", "Board"], ["chat", "Chat"]].map(([key, label]) =>
      h("button", { role: "tab", "aria-selected": ui.tab === key ? "true" : "false", "aria-controls": "panel-" + key, onClick: () => { ui.tab = key; render(); } },
        label, unseen[key] && h("span", { class: "pip", "aria-label": "new" }))));
  return h("div", {}, top,
    h("div", { class: "wrap game-grid" },
      h("div", { class: "panel-col" }, panel("card", "My card"), panel("case", "Case file")),
      h("div", { class: "panel-col" }, panel("act", "Actions"), panel("board", "Evidence board")),
      h("div", { class: "panel-col" }, panel("chat", "Discussion"))),
    tabs);
}

function spectatorPanel() {
  return h("div", { class: "card" }, h("h2", {}, "You're watching"),
    h("p", {}, "This case started before you arrived. You can follow the board and the discussion, and you'll be dealt in when the host starts the next case."),
    h("p", { class: "small muted" }, "Spectators can't chat during a case, so nobody can pass hints to the players."));
}

function cardPanel() {
  const m = me();
  const c = g().scenario.characters.find((x) => x.id === m.charId);
  const canShare = !["briefing", "resolution"].includes(g().phase);
  return h("div", { class: "card secret-card stack" },
    h("div", { class: "row" }, h("span", { class: "small muted grow" }, "Private: only you can see this"),
      h("button", { class: "link small", onClick: () => { ui.hideCard = !ui.hideCard; render(); }, "aria-pressed": ui.hideCard ? "true" : "false" }, ui.hideCard ? "Show card" : "Hide card")),
    h("div", {}, h("div", { class: "small muted" }, "You are"), h("h2", {}, c.name), h("p", { class: "small muted" }, c.age, ", ", c.occupation)),
    ui.hideCard ? h("p", { class: "muted" }, "Card hidden.") : [
      h("div", {}, h("span", { class: "badge " + (m.role === "culprit" ? "bad" : "teal") }, m.roleName),
        h("p", { class: "small", style: "margin-top:6px" }, m.ability)),
      m.culprit && h("div", { class: "culprit-box" }, h("b", {}, "What really happened. "), gloss(m.culprit.truth),
        m.culprit.danger && h("p", { class: "small", style: "margin:6px 0 0" }, h("b", {}, "Watch out: "), gloss(m.culprit.danger))),
      h("p", {}, h("b", {}, "Goal: "), gloss(m.goal)),
      h("p", { class: "small" }, h("b", {}, "Honesty: "), m.honesty),
      h("div", { class: "reveal-box" }, h("b", {}, m.role === "culprit" ? "A lesser secret (true): " : "Your secret: "), gloss(m.secret),
        h("div", { class: "row", style: "margin-top:6px" },
          m.used.confessed ? h("span", { class: "badge" }, "Confessed")
            : h("button", { class: "btn small", disabled: !canShare, onClick: () => { ui.confirm = { text: "Confess your secret to everyone? It clears the air, but you lose your secret bonus.", go: () => act("confess") }; render(); } }, "Confess"),
        ),
        ui.confirm && !ui.menuFor && confirmBox()),
      h("div", { class: "stack" }, h("h3", {}, "What you know, in your own words"),
        m.knowledge.map((k) => h("div", { class: "reveal-box" },
          k.cover && h("span", { class: "badge bad" }, "Your cover story (a lie)"), k.recall && h("span", { class: "badge gold" }, "Recalled"),
          h("p", { style: "margin:4px 0" }, gloss(k.text)),
          k.shared ? h("span", { class: "badge good" }, "Shared")
            : h("button", { class: "btn small", disabled: !canShare, onClick: () => act("share", { knowledgeId: k.id }) }, k.cover ? "Tell everyone this story" : "Share as a statement"))),
        m.role === "witness" && !m.used.recall && h("button", { class: "btn small", disabled: !canShare || g().phase === "vote", onClick: () => act("recall") }, "Recall a detail (once)")),
      m.hand.length > 0 && h("div", { class: "stack" }, h("h3", {}, "Clues in your hand"),
        h("p", { class: "small muted" }, "Only you have seen these. Unshared clues go on the board, under your name, when the round ends", m.hand.some((x) => x.quiet) ? " (your quiet find is handed in anonymously)." : "."),
        m.hand.map((cl) => h("div", { class: "entry clue" }, h("div", { class: "meta" }, cl.place, cl.quiet && h("span", { class: "badge" }, "Quiet")),
          h("h3", {}, cl.title), h("p", {}, gloss(cl.text)),
          h("button", { class: "btn small teal", onClick: () => act("publish", { clueId: cl.clueId }) }, "Share to the board")))),
    ]);
}

function casePanel() {
  const s = g().scenario;
  return h("div", { class: "card stack" },
    h("h2", {}, s.title), h("p", { class: "small muted" }, s.location, " · ", s.tone),
    h("p", {}, gloss(s.intro)),
    h("div", { class: "reveal-box" }, h("b", {}, "Victim: "), s.victim.name, ". ", gloss(s.victim.description)),
    h("p", {}, h("b", {}, "The window: "), `${s.window.from}–${s.window.to}`, ", at ", s.window.scene, "."),
    h("h3", {}, "The people here"),
    h("ul", { class: "suspects" }, s.characters.map((c) => {
      const by = c.playedBy;
      return h("li", {},
        h("div", { class: "row" }, h("b", { class: "grow" }, c.name), by ? h("span", { class: "badge" + (by === view.me.id ? " accent" : "") }, by === view.me.id ? "You" : nameOfPlayer(by)) : h("span", { class: "badge" }, "Not played")),
        h("div", { class: "small muted" }, c.age, ", ", c.occupation),
        h("div", { class: "small" }, gloss(c.bio), " ", gloss(c.relation)));
    })),
    h("h3", {}, "Places"),
    h("ul", { class: "small" }, s.places.map((p) => h("li", {}, p.name, p.restricted ? " (restricted)" : ""))));
}

function actPanel() {
  const G = g();
  const m = me();
  if (G.scenario.map && MOVABLE.includes(G.phase)) return mapPanel();
  if (!m) return h("div", { class: "card" }, h("p", { class: "muted" }, PHASE[G.phase].guide));
  if (G.phase === "briefing") return h("div", { class: "card stack" }, h("h2", {}, "Briefing"), h("p", {}, "Read the case and your private card. When the case opens, the starting clues go on the board."), h("p", { class: "small muted" }, "On a phone, use the tabs at the bottom to move between your card, the case, the board and the chat."));
  if (G.phase === "discovery") return h("div", { class: "card stack" }, h("h2", {}, "Discovery"), h("p", {}, "Read the starting clues on the board, and anything other characters have said. Work out who needs an alibi for ", G.scenario.window.from, "–", G.scenario.window.to, "."), h("p", { class: "small muted" }, "Searching opens in the next phase."));
  if (G.phase === "investigate1" || G.phase === "investigate2") {
    const locked = (p) => p.restricted && G.phase === "investigate1" && m.role !== "insider";
    return h("div", { class: "card stack" },
      h("div", { class: "row" }, h("h2", { class: "grow" }, "Search"), h("span", { class: "badge " + (m.searchesLeft ? "teal" : "") }, `${m.searchesLeft} search${m.searchesLeft === 1 ? "" : "es"} left`)),
      m.canQuietSearch && h("label", { class: "check" }, h("input", { type: "checkbox", checked: ui.quiet, onChange: (e) => { ui.quiet = e.target.checked; } }), "Quiet search (culprit, once): don't announce this one"),
      h("div", { class: "places" }, G.scenario.places.map((p) => h("div", { class: "place" },
        h("div", { class: "grow" }, h("div", {}, p.name), h("div", { class: "small muted" }, locked(p) ? "Locked until round 2" : p.remaining ? `${p.remaining} clue${p.remaining === 1 ? "" : "s"} left` : "Searched out")),
        h("button", { class: "btn small teal", disabled: !m.searchesLeft || !p.remaining || locked(p),
          onClick: async () => { const r = await act("search", { place: p.id, quiet: ui.quiet || undefined }); if (r?.ok) { ui.quiet = false; toast(m.role === "detective" ? "Found something. It's on the board, verified." : "Found something. It's in your hand on your card."); } } }, "Search")))),
      h("p", { class: "small muted" }, "Travel times matter: someone ten minutes away can't have been at the scene a minute later."));
  }
  if (G.phase === "arguments") return accusationForm();
  if (G.phase === "vote") return votePanel();
  return h("div");
}

function accusationForm() {
  const m = me();
  if (m.used.accused) return h("div", { class: "card" }, h("h2", {}, "Closing arguments"), h("p", {}, "You've made your accusation. Read the others on the board and get ready to vote."));
  const submit = async (e) => {
    e.preventDefault();
    if (!ui.accuseTarget) return toast("Choose who you're accusing.");
    const r = await act("accuse", { target: ui.accuseTarget, clueId: ui.accuseClue || null, reason: drafts["accuse-reason"] ?? "" });
    if (r?.ok) drafts["accuse-reason"] = "";
  };
  return h("form", { class: "card stack", onSubmit: submit },
      h("h2", {}, "Make your accusation"),
      h("div", {}, h("label", { for: "accuse-target" }, "Who did it?"),
        h("select", { id: "accuse-target", onChange: (e) => { ui.accuseTarget = e.target.value; } },
          h("option", { value: "" }, "Choose a suspect…"),
          seatedChars().filter((c) => c !== m.charId).map((c) => h("option", { value: c, selected: ui.accuseTarget === c }, charName(c))))),
      h("div", {}, h("label", { for: "accuse-clue" }, "The clue that proves it (optional)"), clueSelect("accuse-clue", ui.accuseClue, (v) => { ui.accuseClue = v; })),
      h("div", {}, h("label", { for: "accuse-reason" }, "Why? (280 characters)"), h("textarea", { maxlength: 280, ...draft("accuse-reason") })),
      h("button", { class: "btn primary", type: "submit" }, "Accuse"));
}

function votePanel() {
  const G = g();
  const m = me();
  const voted = G.seats.filter((s) => !s.left && s.voted).length;
  const total = G.seats.filter((s) => !s.left).length;
  return h("div", { class: "card stack" },
    h("div", { class: "row" }, h("h2", { class: "grow" }, "Vote"), h("span", { class: "badge" }, `${voted}/${total} voted`)),
    m.vote && h("p", { class: "guide" }, "Your vote: ", m.vote.target ? charName(m.vote.target) : "Abstain", ". You can change it until the timer ends."),
    h("div", { class: "vote-grid", role: "group", "aria-label": "Suspects" }, seatedChars().filter((c) => c !== m.charId).map((c) =>
      h("button", { class: "btn" + (ui.voteTarget === c ? " chosen" : ""), "aria-pressed": ui.voteTarget === c ? "true" : "false", onClick: () => { ui.voteTarget = c; render(); } },
        h("b", {}, charName(c)), h("span", { class: "small muted" }, "played by ", nameOfPlayer(G.seats.find((s) => s.charId === c).playerId))))),
    h("div", {}, h("label", { for: "vote-clue" }, "Key evidence (earns a bonus if it's decisive)"), clueSelect("vote-clue", ui.voteClue, (v) => { ui.voteClue = v; })),
    h("div", { class: "row" },
      h("button", { class: "btn primary", disabled: !ui.voteTarget, onClick: () => act("vote", { target: ui.voteTarget, clueId: ui.voteClue || null }) }, "Cast secret vote"),
      h("button", { class: "btn", onClick: () => { ui.voteTarget = null; act("vote", { target: null }); } }, "Abstain")));
}

function mapPanel() {
  const G = g();
  const m = me();
  const inv = G.phase === "investigate1" || G.phase === "investigate2";
  return h("div", { class: "stack" },
    h("div", { class: "card stack" },
      h("div", { class: "row" }, h("h2", { class: "grow" }, "The scene"),
        m && inv && h("span", { class: "badge " + (m.searchesLeft ? "teal" : "") }, `${m.searchesLeft} search${m.searchesLeft === 1 ? "" : "es"} left`)),
      mapView.el,
      m?.canQuietSearch && inv && h("label", { class: "check" }, h("input", { type: "checkbox", id: "quiet-search", checked: ui.quiet, onChange: (e) => { ui.quiet = e.target.checked; } }), "Quiet search (culprit, once): don't announce the next one"),
      h("p", { class: "small muted" }, inv
        ? "Glinting spots hold clues: stand on one and press Search. Orange ! marks are errands. Finish two in a round for a bonus search. You can only see people near you, and they can only see you when you're close."
        : G.phase === "arguments" ? "Searching is over, but you can still walk over to talk to someone." : "Walk around and get your bearings. Searching opens in the next phase.")),
    G.phase === "arguments" && m && accusationForm());
}

function clueSelect(id, value, onChange) {
  return h("select", { id, onChange: (e) => onChange(e.target.value) },
    h("option", { value: "" }, "No clue cited"),
    boardClues().map((b) => h("option", { value: b.clueId, selected: value === b.clueId }, b.title)));
}

function boardPanel() {
  const G = g();
  const kinds = { all: null, clue: ["clue"], statement: ["statement", "confession"], accusation: ["accusation"] };
  const items = G.board.filter((b) => !kinds[ui.filter] || kinds[ui.filter].includes(b.kind)).slice().reverse();
  return h("div", { class: "stack" },
    h("div", { class: "row" }, h("h2", { class: "grow" }, "Evidence board"), h("span", { class: "badge" }, `${boardClues().length} clues`)),
    h("div", { class: "filters", role: "group", "aria-label": "Filter the board" },
      [["all", "All"], ["clue", "Clues"], ["statement", "Statements"], ["accusation", "Accusations"]].map(([k, label]) =>
        h("button", { class: "btn small", "aria-pressed": ui.filter === k ? "true" : "false", onClick: () => { ui.filter = k; render(); } }, label))),
    h("div", { class: "feed", "aria-live": "off" }, items.length ? items.map(entry) : h("p", { class: "muted" }, "Nothing here yet.")));
}

function entry(b) {
  const who = (pid) => `${nameOfPlayer(pid)} as ${charName(charOfPlayer(pid))}`;
  if (b.kind === "system") return h("div", { class: "entry system" }, b.text);
  if (b.kind === "found") return h("div", { class: "entry found" }, `${nameOfPlayer(b.by)} searched ${b.place} and found something, but hasn't shared it yet.`);
  if (b.kind === "clue") return h("article", { class: "entry clue" },
    h("div", { class: "meta" }, h("span", { class: "badge teal" }, "Clue"), b.place,
      b.verified && h("span", { class: "badge good" }, "Verified by the detective"),
      h("span", {}, b.place === "Case file" ? "" : b.by ? `· found by ${nameOfPlayer(b.by)}${b.auto ? " (handed in at round end)" : ""}` : "· handed in anonymously")),
    h("h3", {}, b.title), h("p", { style: "margin:0" }, gloss(b.text)));
  if (b.kind === "statement") return h("article", { class: "entry statement" },
    h("div", { class: "meta" }, h("span", { class: "badge gold" }, "Statement"), b.npc ? `${charName(b.charId)} (not played), statement to the police` : `${charName(b.charId)} (${nameOfPlayer(b.by)})`),
    h("p", { style: "margin:0" }, gloss(b.text)),
    !b.npc && h("p", { class: "small muted", style: "margin:4px 0 0" }, "A player's claim. Innocent players can't lie, but the culprit can."));
  if (b.kind === "confession") return h("article", { class: "entry confession" },
    h("div", { class: "meta" }, h("span", { class: "badge bad" }, "Confession"), `${charName(b.charId)} (${nameOfPlayer(b.by)})`), h("p", { style: "margin:0" }, gloss(b.text)));
  if (b.kind === "accusation") return h("article", { class: "entry accusation" },
    h("div", { class: "meta" }, h("span", { class: "badge accent" }, "Accusation"), who(b.by)),
    h("h3", {}, "Accuses ", charName(b.target)), b.clueTitle && h("p", { class: "small", style: "margin:0 0 4px" }, "Citing: ", h("b", {}, b.clueTitle)),
    b.text && h("p", { style: "margin:0" }, b.text));
  return h("div");
}

function chatPanel() {
  const G = g();
  const canChat = !!me() && !G.seats.find((s) => s.playerId === view.me.id)?.muted;
  const send = async (e) => {
    e.preventDefault();
    const text = (drafts["chat-input"] ?? "").trim();
    if (!text) return;
    const r = await act("chat", { text });
    if (r?.ok) { drafts["chat-input"] = ""; render(); }
  };
  const muted = store.get("muted:" + view.code, []);
  return h("div", { class: "card stack" },
    h("h2", {}, "Discussion"),
    h("div", { class: "chat-log", "data-scroll": "chat", role: "log", "aria-label": "Chat messages" },
      G.chat.filter((x) => !muted.includes(x.by)).map((x) => h("div", { class: "msg" }, h("b", {}, nameOfPlayer(x.by)), " ", h("span", { class: "as" }, charName(charOfPlayer(x.by))), h("br"), x.text)),
      G.chat.length === 0 && h("p", { class: "small muted" }, "No messages yet. Ask someone where they were at ", G.scenario.window.from, ".")),
    canChat ? h("form", { class: "row", onSubmit: send },
      h("label", { for: "chat-input", class: "sr-only" }, "Message"),
      h("input", { type: "text", maxlength: 300, placeholder: "Ask, answer, accuse…", class: "grow", autocomplete: "off", ...draft("chat-input") }),
      h("button", { class: "btn primary", type: "submit" }, "Send"))
      : h("p", { class: "small muted" }, me() ? "The host has muted you for this round." : "Spectators can read but not post."),
    h("h3", {}, "At the table"),
    h("ul", { class: "people" }, G.seats.map((s) => h("li", {},
      h("span", { class: "dot" + (s.connected || s.bot ? " on" : ""), "aria-hidden": "true" }),
      h("span", { class: "grow" }, s.name, h("br"), h("span", { class: "small muted" }, charName(s.charId), s.left ? " · left" : "")),
      s.ready && G.phase !== "vote" && h("span", { class: "badge good" }, "Ready"),
      s.voted && h("span", { class: "badge good" }, "Voted"),
      s.muted && h("span", { class: "badge" }, "Muted"),
      s.playerId !== view.me.id && !s.bot && h("button", { class: "link small", onClick: () => {
        const list = store.get("muted:" + view.code, []);
        store.set("muted:" + view.code, list.includes(s.playerId) ? list.filter((x) => x !== s.playerId) : [...list, s.playerId]);
        render();
      } }, muted.includes(s.playerId) ? "Unhide" : "Hide chat"),
      s.playerId !== view.me.id && h("button", { class: "link small", onClick: () => { ui.menuFor = ui.menuFor === s.playerId ? null : s.playerId; render(); } }, "More"),
      ui.menuFor === s.playerId && personMenu(s)))));
}

function personMenu(s) {
  const p = view.people.find((x) => x.id === s.playerId);
  return h("div", { class: "row", style: "width:100%" },
    isHost() && h("button", { class: "btn small", onClick: () => act("mute", { playerId: s.playerId }) }, s.muted ? "Unmute for everyone" : "Mute for everyone"),
    isHost() && p && h("button", { class: "btn small danger", onClick: () => { ui.confirm = { text: `Remove ${s.name}? Their character becomes a non-player character.`, go: () => act("kick", { playerId: s.playerId }) }; render(); } }, "Remove"),
    p && !p.bot && h("button", { class: "btn small", onClick: () => { ui.reportFor = s.playerId; render(); } }, "Report"),
    ui.reportFor === s.playerId && p && reportForm(p),
    ui.confirm && confirmBox());
}

// ---- Results
function results() {
  const r = g().result;
  const myPts = r.points?.[view.me.id];
  const maxVotes = Math.max(1, ...Object.values(r.tally ?? {}));
  const culpritPlayer = nameOfPlayer(r.culprit.playerId);
  return h("div", { class: "wrap stack", style: "padding-bottom:40px" },
    h("section", { class: "card stack" },
      r.aborted ? h("p", { class: "verdict" }, "Case closed early") : h("p", { class: "verdict" }, r.caught ? "Caught!" : "The culprit escaped."),
      r.aborted && h("p", {}, r.reason),
      h("p", { class: "muted" }, `The culprit was played by ${culpritPlayer}.`),
      h("p", { style: "font-size:1.1rem" }, gloss(r.solution.summary)),
      !r.aborted && h("div", { class: "stack" }, h("h3", {}, "The vote"),
        Object.keys(r.tally).length ? Object.entries(r.tally).sort((a, b) => b[1] - a[1]).map(([cid, n]) =>
          h("div", {}, h("div", { class: "row small" }, h("span", { class: "grow" }, charName(cid), cid === r.culprit.charId ? " (culprit)" : ""), h("span", { class: "mono" }, n)),
            h("div", { class: "bar", role: "img", "aria-label": `${n} votes` }, h("span", { style: `width:${(n / maxVotes) * 100}%` }))))
          : h("p", { class: "muted" }, "Nobody voted."),
        h("ul", { class: "small" }, r.votes.map((v) => h("li", {}, nameOfPlayer(v.playerId), ": ", v.target ? charName(v.target) : "abstained", v.clueId ? ` (citing ${g().board.find((b) => b.clueId === v.clueId)?.title ?? v.clueId})` : "")))),
      myPts && h("div", { class: "reveal-box" }, h("b", {}, `Your points this round: ${myPts.total}`),
        h("ul", { class: "small", style: "margin:4px 0 0" }, myPts.lines.length ? myPts.lines.map(([l, n]) => h("li", {}, `${l}: +${n}`)) : h("li", {}, "No points this round.")))),
    h("section", { class: "card stack" }, h("h2", {}, "How it fits together"),
      h("p", {}, h("b", {}, "Motive: "), gloss(r.solution.motive)),
      h("p", {}, h("b", {}, "Method: "), gloss(r.solution.method)),
      h("ol", {}, r.solution.path.map((p) => h("li", {}, gloss(p)))),
      h("p", {}, h("b", {}, "Decisive clues: "), r.decisive.map((d) => d.title).join(" · ")),
      r.missed.length > 0 && h("p", { class: "small muted" }, "Never found: ", r.missed.map((m) => `${m.title} (${m.place})`).join(" · ")),
      h("details", {}, h("summary", {}, "What the culprit really did"), h("p", {}, gloss(r.culpritTruth)))),
    h("section", { class: "card stack" }, h("h2", {}, "Red herrings"),
      r.redHerrings.map((x) => h("div", {}, h("b", {}, x.name, ". "), gloss(x.suspicion), " ", h("span", { class: "muted" }, gloss(x.explanation))))),
    h("section", { class: "card stack" }, h("h2", {}, "Everyone's cards"),
      h("ul", { class: "people" }, r.seats.map((s) => h("li", {},
        h("span", { class: "grow" }, h("b", {}, charName(s.charId)), " · ", s.name, s.left ? " (left)" : "", h("br"),
          h("span", { class: "small muted" }, "Secret: ", gloss(r.characters.find((c) => c.id === s.charId)?.secret ?? ""))),
        h("span", { class: "badge " + (s.role === "culprit" ? "bad" : "teal") }, ROLE_NAMES[s.role]))))),
    Object.keys(view.scores).length > 0 && scoreboard(),
    h("div", { class: "row" },
      isHost() ? h("button", { class: "btn primary", onClick: () => act("rematch") }, "Back to the lobby for another case") : h("p", { class: "muted grow" }, "Waiting for the host to start another case."),
      h("button", { class: "btn danger", onClick: () => act("leave") }, "Leave room")));
}
const ROLE_NAMES = { culprit: "Culprit", detective: "Detective", witness: "Witness", insider: "Insider", secret: "Secret-keeper" };

// ---- Overlays
function overlay(title, ...body) {
  const close = () => { if (ui.overlay === "tutorial") store.set("seenTutorial", true); ui.overlay = null; render(); };
  return h("div", { class: "overlay", onClick: (e) => { if (e.target.classList.contains("overlay")) close(); }, onKeydown: (e) => { if (e.key === "Escape") close(); } },
    h("div", { class: "card stack", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "row" }, h("h2", { class: "grow" }, title), h("button", { class: "btn small", onClick: close, autofocus: true }, "Close")), ...body));
}

function tutorial() {
  return overlay("How to play",
    h("p", {}, "A death at a Kenyan gathering. Everyone at the table plays someone who was there. One of you did it."),
    h("ol", { class: "steps" },
      h("li", {}, h("b", {}, "Briefing. "), "You get a private card: your character, your role, your goal, a secret, and what you know. The culprit's card tells them what really happened, and gives them a cover story."),
      h("li", {}, h("b", {}, "Discovery. "), "The case file opens: the victim, the time window, and the starting clues."),
      h("li", {}, h("b", {}, "Two investigation rounds. "), "Each round you search one place. What you find is private until you share it. Anything you don't share goes on the board, under your name, when the round ends."),
      h("li", {}, h("b", {}, "Closing arguments. "), "Everyone may accuse one suspect, citing a clue."),
      h("li", {}, h("b", {}, "The vote. "), "A secret, simultaneous vote. The culprit is caught only with the most votes outright. A tie lets them escape."),
      h("li", {}, h("b", {}, "The truth. "), "The full solution, everyone's secrets, and points.")),
    h("div", { class: "reveal-box" }, h("b", {}, "The one rule. "), "Only the culprit may lie. Everyone else may dodge questions and keep secrets, but must never say anything false. Secrets make innocent people look guilty. That's the fun."),
    h("div", { class: "reveal-box" }, h("b", {}, "How to solve it. "), "Every case is solvable from the clues. For each person, ask: is there evidence putting them somewhere else for the whole window, too far from the scene to get there? The culprit is the one whose alibi doesn't hold up."),
    h("p", { class: "small muted" }, "Example: the stairwell is 1 minute from the rooftop, but 6 minutes from the kiosk across the road. A receipt putting someone at the kiosk at 21:17 makes it impossible for them to have been in the stairwell at 21:19."),
    h("p", { class: "small muted" }, "First time? Host a room, add three practice bots, and play a case on your own."));
}

function settings() {
  const set = (k, v) => { prefs[k] = v; store.set(k, v); applyPrefs(); render(); };
  return overlay("Settings",
    h("div", {}, h("label", { for: "gloss" }, "Kiswahili and Sheng words"),
      h("select", { id: "gloss", onChange: (e) => set("gloss", e.target.value) },
        [["inline", "Show the English meaning in brackets"], ["hover", "Show the meaning on hover or tap"], ["off", "Don't show meanings"]].map(([v, l]) => h("option", { value: v, selected: prefs.gloss === v }, l)))),
    h("div", {}, h("label", { for: "theme" }, "Theme"),
      h("select", { id: "theme", onChange: (e) => set("theme", e.target.value) },
        [["auto", "Match my device"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => h("option", { value: v, selected: prefs.theme === v }, l)))),
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: prefs.size === "large", onChange: (e) => set("size", e.target.checked ? "large" : "normal") }), "Larger text"));
}

// ---- Boot
setInterval(() => {
  for (const el of document.querySelectorAll("[data-timer]")) {
    const s = remaining();
    el.textContent = fmt(s);
    el.classList.toggle("low", s <= 15);
  }
}, 500);

function boot() {
  const code = /^\/([A-Za-z]{4})$/.exec(location.pathname)?.[1]?.toUpperCase();
  const saved = code && store.get("session:" + code, null);
  if (code && saved) connect(code, saved.token, saved.playerId);
  else { session = null; view = null; es?.close(); render(); loadPublic(); }
}
window.addEventListener("popstate", boot);
boot();
