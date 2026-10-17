#!/usr/bin/env node
// Renders each scenario's JSON into a design doc in docs/scenarios/, so the docs and the game
// can never disagree. `--check` fails if a committed doc is out of date.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarios, materialize, variantIds, boardClues, isCleared, travelTable, toMin } from "../server/scenario.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs", "scenarios");
const check = process.argv.includes("--check");

const gloss = (t) => String(t).replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$1 (*$2*)");
const cell = (t) => gloss(t).replace(/\|/g, "\\|").replace(/\n/g, " ");
const ROLE = { culprit: "Culprit", detective: "Detective", witness: "Witness", insider: "Insider", secret: "Secret-keeper" };

function factText(s, f) {
  const who = f.nobody ? "nobody" + (f.except?.length ? ` (except ${f.except.map((id) => nameOf(s, id)).join(", ")})` : "") : nameOf(s, f.char);
  const when = f.to && f.to !== f.from ? `${f.from}–${f.to}` : f.from;
  const place = s.places.find((p) => p.id === f.place).name;
  return f.absent ? `${who} **not** at ${place}, ${when}` : `${who} at ${place}, ${when}`;
}
const nameOf = (s, id) => (id === s.victim.id ? s.victim.name : s.characters.find((c) => c.id === id)?.name ?? id);

function audit(s) {
  const board = boardClues(s);
  const facts = board.flatMap((c) => (c.facts ?? []).filter((f) => f.char && !f.absent).map((f) => ({ ...f, clue: c.id })));
  const dist = travelTable(s);
  const culprit = Object.keys(s.roles).find((k) => s.roles[k] === "culprit");
  const lines = [];
  for (const c of s.characters) {
    const cleared = isCleared(s, c.id, facts, dist);
    const own = [...new Set(facts.filter((f) => f.char === c.id && f.place !== s.scene).map((f) => f.clue))];
    lines.push(`| ${c.name} | ${cleared ? "Cleared" : "**Not cleared**"} | ${own.length ? own.map((id) => `\`${id}\``).join(", ") : "none"} |`);
  }
  const cover = s.culprit.cover;
  const [c0, c1] = [toMin(cover.from), toMin(cover.to)];
  const refuting = board.filter((c) => (c.facts ?? []).some((f) => {
    const f0 = toMin(f.from), f1 = toMin(f.to ?? f.from);
    if (f0 > c1 || c0 > f1) return false;
    if (f.nobody) return f.place === cover.place && !(f.except ?? []).includes(culprit);
    return f.char === culprit && (f.absent ? f.place === cover.place : f.place !== cover.place);
  })).map((c) => `\`${c.id}\``);
  return [
    "| Character | Board evidence | Clues that place them elsewhere |", "|---|---|---|", ...lines, "",
    `Cover story ("${cell(cover.text)}") is contradicted by ${refuting.join(", ")}.`,
    `Searchable clues: ${board.filter((c) => c.where !== "start").length}, against ${2 * s.players.min} searches at the minimum player count.`,
  ];
}

function cluesSection(s) {
  const out = [];
  const tag = (c) => (c.tags ?? []).filter((t) => ["decisive", "red-herring", "motive", "alibi"].includes(t)).map((t) => `*${t}*`).join(", ");
  const row = (c) => {
    const facts = (c.facts ?? []).map((f) => factText(s, f)).join("; ");
    return `| \`${c.id}\` | ${cell(c.title)} | ${cell(c.text)} | ${facts || "–"} | ${tag(c) || "–"} |`;
  };
  out.push("**Starting clues** (on the board at Discovery)", "", "| ID | Clue | Text | Establishes | Tags |", "|---|---|---|---|---|");
  out.push(...s.clues.filter((c) => c.where === "start").map(row), "");
  for (const p of s.places) {
    const here = s.clues.filter((c) => c.where === p.id);
    if (!here.length) continue;
    out.push(`**Search: ${p.name}**${p.restricted ? " (restricted: Insider only in round 1)" : ""}`, "", "| ID | Clue | Text | Establishes | Tags |", "|---|---|---|---|---|");
    out.push(...here.map(row), "");
  }
  return out;
}

function roleCards(s) {
  const out = [];
  for (const c of s.characters) {
    const role = s.roles[c.id];
    out.push(`#### ${c.name} (${ROLE[role]})`, "");
    if (role === "culprit") {
      out.push(`- **Goal:** ${gloss(s.culprit.objective)}`, `- **What really happened:** ${gloss(s.culprit.truth)}`,
        `- **Cover story:** "${gloss(s.culprit.cover.text)}"`, `- **Danger:** ${gloss(s.culprit.danger ?? "")}`,
        `- **Lesser secret you can confess (it's true):** ${gloss(c.secret)}`);
    } else {
      out.push(`- **Goal:** ${gloss(c.goal)}`, `- **Secret:** ${gloss(c.secret)}`);
    }
    for (const k of c.knowledge) {
      out.push(`- **Knows (in their own words):** "${gloss(k.text)}"`);
      if (k.recall && role === "witness") out.push(`- **Recall (witness ability):** ${gloss(k.recall)}`);
    }
    out.push("");
  }
  return out;
}

function timeline(s) {
  const rows = [];
  for (const [id, segs] of Object.entries(s.timeline)) {
    for (const g of segs) rows.push({ who: nameOf(s, id), from: g.from, to: g.to, place: s.places.find((p) => p.id === g.place).name, note: g.note ?? "" });
  }
  rows.sort((a, b) => toMin(a.from) - toMin(b.from) || a.who.localeCompare(b.who));
  return ["| From | To | Who | Where | Note |", "|---|---|---|---|---|", ...rows.map((r) => `| ${r.from} | ${r.to} | ${r.who} | ${r.place} | ${cell(r.note)} |`)];
}

function variantBody(s, heading) {
  return [
    heading, "",
    `**Roles:** ${s.characters.map((c) => `${c.name}: ${ROLE[s.roles[c.id]]}`).join(" · ")}`, "",
    "#### Solution", "",
    `- **Culprit:** ${nameOf(s, Object.keys(s.roles).find((k) => s.roles[k] === "culprit"))}`,
    `- **Motive:** ${gloss(s.solution.motive)}`, `- **Method:** ${gloss(s.solution.method)}`, `- **Summary:** ${gloss(s.solution.summary)}`,
    `- **Decisive clues:** ${s.solution.decisive.map((id) => `\`${id}\``).join(", ")}`, "",
    "#### Solution path", "", ...s.solution.path.map((p, i) => `${i + 1}. ${gloss(p)}`), "",
    "#### Red herrings", "", ...s.redHerrings.map((r) => `- **${nameOf(s, r.char)}.** *Why they look guilty:* ${gloss(r.suspicion)} *The real explanation:* ${gloss(r.explanation)} (${r.clues.map((id) => `\`${id}\``).join(", ")})`), "",
    "#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)", "", ...audit(s), "",
  ];
}

function render(base) {
  const s = materialize(base, "A");
  const dist = travelTable(s);
  const out = [
    `# ${s.title}`, "",
    "> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.", "",
    `*Generated from \`scenarios/${base.id}.json\` by \`npm run render\`. Edit the JSON, not this file.*`, "",
    "| | |", "|---|---|",
    `| Location | ${s.location} |`, `| Tone | ${s.tone} |`, `| Play time | about ${s.minutes} minutes |`,
    `| Players | ${s.players.min}–${s.players.max} |`, `| Variants | ${variantIds(base).length} (${variantIds(base).map((v) => materialize(base, v).variantName).join(", ")}) |`,
    `| Content notes | ${s.contentNotes.join("; ")} |`, "",
    "## Public introduction", "", gloss(s.intro), "",
    `**Victim:** ${s.victim.name}, ${gloss(s.victim.description)}`, "",
    `**Window:** ${s.window.from}–${s.window.to} at ${s.places.find((p) => p.id === s.scene).name}.`, "",
    "## Cast (public)", "", "| Character | Age | Occupation | Public bio | Relationship to the victim |", "|---|---|---|---|---|",
    ...s.characters.map((c) => `| ${c.name} | ${c.age} | ${c.occupation} | ${cell(c.bio)} | ${cell(c.relation)} |`), "",
    `**Seat order** (who is played first when there are fewer than ${s.characters.length} players; the culprit is always played): ${s.seatPriority.map((id) => nameOf(s, id)).join(" → ")}. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.`, "",
    "## Places and travel times", "",
    `| | ${s.places.map((p) => p.name).join(" | ")} |`, `|---|${s.places.map(() => "---").join("|")}|`,
    ...s.places.map((a) => `| **${a.name}** | ${s.places.map((b) => dist[a.id][b.id]).join(" | ")} |`), "",
    "Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.", "",
    "## Walkable map", "",
    `Sight radius **${s.map.vision} tiles** · players start in **${s.places.find((p) => p.id === s.map.spawn).name}**. The map isn't to scale: story times use the travel table above, while the map sets how long walking takes in real time.`, "",
    "```", ...s.map.tiles.map((r) => r.replace(/\s+$/, "")), "```", "",
    "Key: `#` wall · `.` path · `:` door · capital letter = a place's floor · lowercase letter = a clue spot in that place · digit = errand.", "",
    "| Letter | Place | Clue spots |", "|---|---|---|",
    ...Object.entries(s.map.legend).map(([l, id]) => `| ${l} | ${s.places.find((p) => p.id === id).name}${s.places.find((p) => p.id === id).restricted ? " (restricted)" : ""} | ${(s.map.tiles.join("").match(new RegExp(l.toLowerCase(), "g")) ?? []).length} |`), "",
    "| Errand | Seconds |", "|---|---|", ...s.map.errands.map((e, i) => `| ${i + 1}. ${e.label} | ${e.seconds} |`), "",
    "## Clues", "", ...cluesSection(s),
    "## Private role cards (original variant)", "", ...roleCards(s),
    "## True timeline (original variant)", "", ...timeline(s), "",
    ...variantBody(s, `## Variant A: ${s.variantName}`),
  ];
  for (const v of base.variants ?? []) {
    const m = materialize(base, v.id);
    out.push(`## Variant ${v.id}: ${v.name}`, "", gloss(v.summary), "");
    const changed = [
      ...(v.clues?.update ? Object.keys(v.clues.update).map((id) => `clue \`${id}\` changes`) : []),
      ...(v.clues?.add ?? []).map((c) => `clue \`${c.id}\` is added`),
      ...(v.clues?.remove ?? []).map((id) => `clue \`${id}\` is removed`),
      ...(v.timeline ? Object.keys(v.timeline).map((id) => `${nameOf(m, id)}'s movements change`) : []),
      ...(v.characters ? Object.keys(v.characters).map((id) => `${nameOf(m, id)}'s card changes`) : []),
    ];
    out.push(`**What changes:** ${changed.join("; ") || "role assignments only"}.`, "");
    if (v.clues?.update || v.clues?.add) {
      out.push("**Changed clues**", "", "| ID | Clue | Where | Text | Establishes |", "|---|---|---|---|---|");
      for (const id of [...Object.keys(v.clues.update ?? {}), ...(v.clues.add ?? []).map((c) => c.id)]) {
        const c = m.clues.find((x) => x.id === id);
        const where = c.where === "start" ? "Start" : m.places.find((p) => p.id === c.where).name;
        out.push(`| \`${c.id}\` | ${cell(c.title)} | ${where} | ${cell(c.text)} | ${(c.facts ?? []).map((f) => factText(m, f)).join("; ") || "–"} |`);
      }
      out.push("");
    }
    if (v.culprit) out.push(`**Culprit's card:** ${gloss(m.culprit.truth)} Cover story: "${gloss(m.culprit.cover.text)}"`, "");
    if (v.timeline) out.push("**True timeline**", "", ...timeline(m), "");
    out.push(...variantBody(m, "### Solution and audit").slice(2));
  }
  out.push("## Details needing local review", "", ...s.reviewFlags.map((f) => `- [ ] ${f}`), "");
  return out.join("\n");
}

let stale = 0;
for (const base of loadScenarios()) {
  const file = join(outDir, `${base.id}.md`);
  const text = render(base);
  if (check) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== text) {
      console.log(`docs/scenarios/${base.id}.md is out of date. Run: npm run render`);
      stale++;
    }
  } else {
    writeFileSync(file, text);
    console.log(`wrote docs/scenarios/${base.id}.md`);
  }
}
process.exit(stale ? 1 : 0);
