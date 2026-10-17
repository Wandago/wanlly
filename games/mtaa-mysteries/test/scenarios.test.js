import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScenarios, materialize, validate, validateAll, variantIds } from "../server/scenario.js";

const all = loadScenarios();
const base = all.find((s) => s.id === "mwangaza-court");

test("there are at least six scenarios, each with a variant", () => {
  assert.ok(all.length >= 6);
  for (const s of all) assert.ok(variantIds(s).length >= 2, `${s.id} needs a variant`);
  assert.equal(new Set(all.map((s) => s.location)).size, all.length, "every scenario has its own location");
});

test("every scenario and variant passes the fair-play checker", () => {
  assert.deepEqual(validateAll(all), []);
});

test("scenarios rotate the culprit or change the story across variants", () => {
  for (const s of all) {
    const versions = variantIds(s).map((v) => materialize(s, v));
    const distinct = new Set(versions.map((m) => JSON.stringify([m.roles, m.solution.motive, m.clues.map((c) => c.where)])));
    assert.equal(distinct.size, versions.length, `${s.id}: variants must differ`);
  }
  const swaps = all.filter((s) => new Set(variantIds(s).map((v) => Object.entries(materialize(s, v).roles).find(([, r]) => r === "culprit")[0])).size > 1);
  assert.ok(swaps.length >= 2, "at least two scenarios swap the culprit between variants");
});

// Each mutation breaks one fairness rule; the checker must notice every one.
const mutations = {
  "an innocent loses their only alibi": (s) => { s.clues = s.clues.filter((c) => c.id !== "c-live"); },
  "a clue contradicts the true timeline": (s) => { s.clues.find((c) => c.id === "c-kiosk").facts[0].to = "21:40"; },
  "someone moves faster than travel allows": (s) => { s.timeline.brian[2].from = "21:21"; },
  "an innocent is at the scene during the window": (s) => {
    s.timeline.faith = [{ from: "20:00", to: "21:14", place: "rooftop" }, { from: "21:16", to: "21:17", place: "stairwell" }, { from: "21:18", to: "22:00", place: "rooftop" }];
  },
  "nothing breaks the cover story": (s) => { s.clues = s.clues.filter((c) => c.id !== "c-logbook"); },
  "the cover story is actually true": (s) => { s.culprit.cover = { text: "x", place: "stairwell", from: "21:14", to: "21:20" }; },
  "the decisive clue is only in someone's head": (s) => { s.solution.decisive = ["k-joseph"]; },
  "no motive clue on the board": (s) => { s.clues.find((c) => c.id === "c-ledger").tags = []; },
  "only one red herring": (s) => { s.redHerrings.pop(); },
  "a red herring points at the culprit": (s) => { s.redHerrings[0].char = "brian"; },
  "more clues than searches": (s) => { for (let i = 0; i < 3; i++) s.clues.push({ id: `x${i}`, where: "gate", title: "t", text: "t" }); },
  "two culprits": (s) => { s.roles.faith = "culprit"; },
  "broken glossary markup": (s) => { s.intro += " [[chama savings]]"; },
  "a 'nobody' fact while someone is there": (s) => { s.clues.find((c) => c.id === "c-logbook").facts[2].except = []; },
  "no places reachable": (s) => { s.routes = s.routes.filter((r) => r[1] !== "kiosk"); },
  "knowledge written in the second person": (s) => { s.characters[1].knowledge[0].text = "You were on the mic all night."; },
};

for (const [name, mutate] of Object.entries(mutations)) {
  test(`checker catches: ${name}`, () => {
    const s = materialize(base, "A");
    mutate(s);
    assert.ok(validate(s).length > 0, "expected at least one problem");
  });
}
