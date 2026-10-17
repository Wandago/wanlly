// Scenario loading, variant materialization and the fair-play checker.
//
// A scenario is data (scenarios/*.json). The checker proves, for every variant, that:
//   - the true timeline is physically possible (no one is in two places, travel times hold),
//   - every clue and every innocent's knowledge agrees with the true timeline,
//   - evidence on the board (start + searchable clues) clears every innocent and only them,
//   - the culprit's cover story is contradicted by board evidence,
//   - there is a motive clue, decisive clues, and at least two explained red herrings.
// See docs/03-rules-and-roles.md "Fair-play guarantee".
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const SCENARIO_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "scenarios");
export const ROLES = ["culprit", "detective", "witness", "insider", "secret"];

export function toMin(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

export function loadScenarios(dir = SCENARIO_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

/** Apply a variant's overrides to the base scenario. Variant "A" is the base itself. */
export function materialize(base, variantId = "A") {
  const s = structuredClone(base);
  delete s.variants;
  s.variantId = "A";
  s.variantName = base.variantName ?? "Original";
  if (variantId === "A") return s;
  const v = (base.variants ?? []).find((x) => x.id === variantId);
  if (!v) throw new Error(`${base.id}: unknown variant ${variantId}`);
  s.variantId = v.id;
  s.variantName = v.name;
  for (const key of ["roles", "culprit", "solution", "redHerrings", "seatPriority"]) {
    if (v[key]) s[key] = structuredClone(v[key]);
  }
  for (const [id, patch] of Object.entries(v.characters ?? {})) {
    const c = s.characters.find((x) => x.id === id);
    if (!c) throw new Error(`${base.id}/${v.id}: variant patches unknown character ${id}`);
    Object.assign(c, structuredClone(patch));
  }
  for (const [id, segs] of Object.entries(v.timeline ?? {})) s.timeline[id] = structuredClone(segs);
  const cl = v.clues ?? {};
  s.clues = s.clues.filter((c) => !(cl.remove ?? []).includes(c.id));
  for (const [id, patch] of Object.entries(cl.update ?? {})) {
    const c = s.clues.find((x) => x.id === id);
    if (!c) throw new Error(`${base.id}/${v.id}: variant updates unknown clue ${id}`);
    Object.assign(c, structuredClone(patch));
  }
  s.clues.push(...structuredClone(cl.add ?? []));
  return s;
}

export function variantIds(base) {
  return ["A", ...(base.variants ?? []).map((v) => v.id)];
}

/** Shortest travel minutes between every pair of places (Floyd–Warshall over routes). */
export function travelTable(s) {
  const ids = s.places.map((p) => p.id);
  const d = Object.fromEntries(ids.map((a) => [a, Object.fromEntries(ids.map((b) => [b, a === b ? 0 : Infinity]))]));
  for (const [a, b, m] of s.routes) {
    if (d[a] && d[b]) d[a][b] = d[b][a] = Math.min(d[a][b], m);
  }
  for (const k of ids) for (const i of ids) for (const j of ids) {
    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
  }
  return d;
}

export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const span = (f) => [toMin(f.from), toMin(f.to ?? f.from)];
const overlaps = (a0, a1, b0, b1) => a0 <= b1 && b0 <= a1;

export function boardClues(s) {
  return s.clues.filter((c) => c.where === "start" || s.places.some((p) => p.id === c.where));
}

function presenceFacts(clues) {
  return clues.flatMap((c) => (c.facts ?? []).filter((f) => f.char && !f.absent).map((f) => ({ ...f, clue: c.id })));
}

/**
 * A character is cleared when, for every minute of the window, some board fact puts them
 * somewhere other than the scene and too far away to have reached it by that minute.
 */
export function isCleared(s, charId, facts, dist = travelTable(s)) {
  const [w0, w1] = span(s.window);
  const mine = facts.filter((f) => f.char === charId && f.place !== s.scene);
  for (let t = w0; t <= w1; t++) {
    const ok = mine.some((f) => {
      const [f0, f1] = span(f);
      const gap = t < f0 ? f0 - t : t > f1 ? t - f1 : 0;
      return gap < dist[f.place][s.scene];
    });
    if (!ok) return false;
  }
  return true;
}

function truthAt(s, charId, place, m) {
  return (s.timeline[charId] ?? []).some((g) => g.place === place && toMin(g.from) <= m && m <= toMin(g.to));
}

function everyString(value, path, out) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => everyString(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) everyString(v, `${path}.${k}`, out);
  return out;
}

/** Returns a list of human-readable problems; empty means the variant is fair and consistent. */
export function validate(s) {
  const errs = [];
  const err = (m) => errs.push(`${s.id}/${s.variantId}: ${m}`);
  const need = (cond, m) => cond || err(m);

  for (const k of ["id", "title", "location", "tone", "intro", "scene"]) need(typeof s[k] === "string" && s[k], `missing ${k}`);
  need(s.victim?.id && s.victim?.name && s.victim?.description, "victim needs id, name, description");
  need(Number.isInteger(s.minutes) && s.minutes > 0, "minutes must be a positive integer");
  need(s.players?.min >= 4 && s.players?.max <= s.characters?.length && s.players.min <= s.players.max,
    "players.min must be ≥ 4 and players.max ≤ number of characters");
  need(Array.isArray(s.contentNotes), "contentNotes must be a list");
  need(Array.isArray(s.reviewFlags) && s.reviewFlags.length > 0, "reviewFlags must list details needing local review");
  if (errs.length) return errs;

  const placeIds = new Set(s.places.map((p) => p.id));
  const charIds = s.characters.map((c) => c.id);
  const chars = new Set(charIds);
  const people = new Set([...charIds, s.victim.id]);
  need(placeIds.size === s.places.length, "duplicate place ids");
  need(chars.size === charIds.length, "duplicate character ids");
  need(!chars.has(s.victim.id), "victim id must not be a character id");
  need(new Set(s.characters.map((c) => c.name)).size === charIds.length, "character names must be unique");
  need(placeIds.has(s.scene), `scene ${s.scene} is not a place`);
  for (const [a, b, m] of s.routes) need(placeIds.has(a) && placeIds.has(b) && m > 0, `bad route ${a}-${b}`);
  const dist = travelTable(s);
  for (const a of placeIds) for (const b of placeIds) need(dist[a][b] < Infinity, `no route between ${a} and ${b}`);

  const [w0, w1] = span(s.window);
  need(w0 < w1, "window.from must be before window.to");

  for (const c of s.characters) {
    for (const k of ["name", "occupation", "bio", "relation", "secret", "goal"]) need(c[k], `${c.id}: missing ${k}`);
    need(Number.isInteger(c.age), `${c.id}: age must be an integer`);
    need(Array.isArray(c.knowledge) && c.knowledge.length > 0, `${c.id}: needs at least one knowledge item`);
  }

  // Roles
  const roleOf = s.roles ?? {};
  need(charIds.every((id) => ROLES.includes(roleOf[id])), "every character needs a role from " + ROLES.join("/"));
  const culpritId = charIds.find((id) => roleOf[id] === "culprit");
  need(charIds.filter((id) => roleOf[id] === "culprit").length === 1, "exactly one culprit");
  for (const r of ["detective", "witness"]) need(charIds.filter((id) => roleOf[id] === r).length <= 1, `at most one ${r}`);
  for (const id of charIds.filter((x) => roleOf[x] === "witness")) {
    need(s.characters.find((c) => c.id === id).knowledge.some((k) => k.recall), `witness ${id} needs a knowledge item with recall`);
  }
  need(s.seatPriority?.length === charIds.length && charIds.every((id) => s.seatPriority.includes(id)),
    "seatPriority must list every character exactly once");
  if (!culpritId) return errs;

  // True timeline: well-formed, no overlaps, travel times respected
  for (const id of people) {
    const segs = s.timeline[id];
    if (!need(Array.isArray(segs) && segs.length, `timeline missing for ${id}`)) continue;
    let prev = null;
    for (const g of segs) {
      const [g0, g1] = span(g);
      if (!need(placeIds.has(g.place) && g0 <= g1, `${id}: bad timeline segment ${JSON.stringify(g)}`)) continue;
      if (prev) {
        const gap = g0 - toMin(prev.to);
        need(gap >= dist[prev.place][g.place],
          `${id}: ${prev.place}@${prev.to} → ${g.place}@${g.from} needs ${dist[prev.place][g.place]} min, has ${gap}`);
      }
      prev = g;
    }
  }
  const atScene = (id) => [...Array(w1 - w0 + 1).keys()].map((i) => w0 + i).filter((m) => truthAt(s, id, s.scene, m));
  // victimPresent: false means the act happened at the scene while the victim was away (e.g. a tampered drink)
  if (s.victimPresent === false) {
    need(atScene(culpritId).length > 0, "culprit is never at the scene during the window");
  } else {
    const victimMins = atScene(s.victim.id);
    need(victimMins.length > 0, "victim is never at the scene during the window");
    need(atScene(culpritId).some((m) => victimMins.includes(m)), "culprit is never at the scene with the victim during the window");
  }
  for (const id of charIds.filter((x) => x !== culpritId)) need(atScene(id).length === 0, `innocent ${id} is at the scene during the window`);

  // Every fact must agree with the truth
  const checkFact = (f, where) => {
    const [f0, f1] = span(f);
    if (!need(!Number.isNaN(f0) && !Number.isNaN(f1) && f0 <= f1 && placeIds.has(f.place), `${where}: bad fact ${JSON.stringify(f)}`)) return;
    if (f.nobody) {
      for (const id of people) for (let m = f0; m <= f1; m++) {
        if (!(f.except ?? []).includes(id) && truthAt(s, id, f.place, m)) return err(`${where}: says nobody at ${f.place} but ${id} is there at ${hhmm(m)}`);
      }
    } else if (!need(people.has(f.char), `${where}: unknown character ${f.char}`)) {
      return;
    } else if (f.absent) {
      for (let m = f0; m <= f1; m++) if (truthAt(s, f.char, f.place, m)) return err(`${where}: says ${f.char} absent from ${f.place} but true timeline has them there`);
    } else {
      for (let m = f0; m <= f1; m++) if (!truthAt(s, f.char, f.place, m)) return err(`${where}: puts ${f.char} at ${f.place} ${f.from}–${f.to ?? f.from}, contradicting the true timeline`);
    }
  };
  const clueIds = new Set();
  for (const c of s.clues) {
    need(!clueIds.has(c.id), `duplicate clue id ${c.id}`);
    clueIds.add(c.id);
    need(c.title && c.text, `clue ${c.id}: needs title and text`);
    need(c.where === "start" || placeIds.has(c.where), `clue ${c.id}: where must be "start" or a place id`);
    for (const a of c.about ?? []) need(people.has(a), `clue ${c.id}: about unknown ${a}`);
    for (const f of c.facts ?? []) checkFact(f, `clue ${c.id}`);
  }
  // Knowledge doubles as the statement a player posts to the board, so it must be in the character's own words.
  const firstPerson = (t) => !/^(you|your)\b/i.test(t) && /\b(I|I'm|I'd|I've|me|my|we|our)\b/.test(t);
  for (const c of s.characters) for (const k of c.knowledge) {
    need(k.id && k.text, `${c.id}: knowledge needs id and text`);
    need(firstPerson(k.text ?? ""), `${c.id} knowledge ${k.id}: write it in the first person ("I was…"), since it is posted as a statement`);
    if (k.recall) need(firstPerson(k.recall), `${c.id} knowledge ${k.id}: write the recall in the first person`);
    for (const f of k.facts ?? []) checkFact(f, `${c.id} knowledge ${k.id}`);
  }

  // Board-only deduction: exactly the culprit remains uncleared
  const board = boardClues(s);
  const facts = presenceFacts(board);
  for (const id of charIds) {
    const cleared = isCleared(s, id, facts, dist);
    if (id === culpritId) need(!cleared, "board evidence clears the culprit");
    else need(cleared, `board evidence does not clear innocent ${id} for every minute of ${s.window.from}–${s.window.to}`);
  }
  const searchable = board.filter((c) => c.where !== "start");
  need(board.length - searchable.length >= 2, "needs at least 2 start clues");
  need(searchable.length <= 2 * s.players.min,
    `${searchable.length} searchable clues, but ${s.players.min} players only get ${2 * s.players.min} searches`);

  // Culprit brief and cover story
  const cul = s.culprit ?? {};
  need(cul.objective && cul.truth && cul.cover?.text, "culprit needs objective, truth and cover.text");
  if (cul.cover?.place) {
    const [c0, c1] = span(cul.cover);
    need(overlaps(c0, c1, w0, w1), "cover story must cover the window");
    let honest = true;
    for (let m = c0; m <= c1; m++) if (!truthAt(s, culpritId, cul.cover.place, m)) honest = false;
    need(!honest, "cover story is actually true");
    const refutes = board.filter((c) => (c.facts ?? []).some((f) => {
      const [f0, f1] = span(f);
      if (!overlaps(f0, f1, c0, c1)) return false;
      if (f.nobody) return f.place === cul.cover.place && !(f.except ?? []).includes(culpritId);
      if (f.char !== culpritId) return false;
      return f.absent ? f.place === cul.cover.place : f.place !== cul.cover.place;
    }));
    need(refutes.length > 0, "no board clue contradicts the culprit's cover story");
    need(refutes.some((c) => (s.solution?.decisive ?? []).includes(c.id)), "a clue that breaks the cover story must be marked decisive");
  } else {
    err("culprit.cover needs place, from, to");
  }

  // Solution, motive, red herrings
  const sol = s.solution ?? {};
  need(sol.motive && sol.method && sol.summary, "solution needs motive, method, summary");
  need(Array.isArray(sol.path) && sol.path.length >= 3, "solution.path needs at least 3 reasoning steps");
  need(Array.isArray(sol.decisive) && sol.decisive.length > 0, "solution.decisive must list clue ids");
  for (const id of sol.decisive ?? []) need(board.some((c) => c.id === id), `decisive clue ${id} must be a start or searchable clue`);
  need(board.some((c) => (c.tags ?? []).includes("motive") && (c.about ?? []).includes(culpritId)), "no board clue shows the culprit's motive");
  const rh = s.redHerrings ?? [];
  need(rh.length >= 2, "needs at least 2 red herrings");
  for (const r of rh) {
    need(chars.has(r.char) && r.char !== culpritId, `red herring must point at an innocent, not ${r.char}`);
    need(r.suspicion && r.explanation, `red herring ${r.char}: needs suspicion and explanation`);
    need((r.clues ?? []).length > 0 && r.clues.every((id) => clueIds.has(id)), `red herring ${r.char}: clue ids must exist`);
  }

  // Glossary markup: [[term|gloss]]
  for (const [path, str] of everyString(s, "", [])) {
    const opens = (str.match(/\[\[/g) ?? []).length;
    const good = (str.match(/\[\[[^[\]|]+\|[^[\]]+\]\]/g) ?? []).length;
    need(opens === good && opens === (str.match(/\]\]/g) ?? []).length, `bad [[term|gloss]] markup at ${path}`);
  }
  return errs;
}

export function validateAll(scenarios) {
  const errs = [];
  const ids = new Set();
  for (const base of scenarios) {
    if (ids.has(base.id)) errs.push(`duplicate scenario id ${base.id}`);
    ids.add(base.id);
    for (const v of variantIds(base)) {
      try {
        errs.push(...validate(materialize(base, v)));
      } catch (e) {
        errs.push(e.message);
      }
    }
  }
  return errs;
}

/** Public, spoiler-free metadata for the lobby. */
export function publicMeta(base) {
  return {
    id: base.id, title: base.title, location: base.location, tone: base.tone, minutes: base.minutes,
    players: base.players, contentNotes: base.contentNotes, teaser: base.teaser ?? "",
    variants: variantIds(base).length,
  };
}
