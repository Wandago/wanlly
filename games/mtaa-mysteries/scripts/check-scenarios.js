#!/usr/bin/env node
// Fair-play checker for every scenario and variant. Exit 1 on any problem.
import { loadScenarios, validateAll, variantIds } from "../server/scenario.js";

const scenarios = loadScenarios();
const errs = validateAll(scenarios);
for (const s of scenarios) console.log(`${errs.some((e) => e.startsWith(s.id + "/")) ? "FAIL" : "ok  "}  ${s.id} (${variantIds(s).join(", ")})`);
if (errs.length) {
  console.error("\n" + errs.join("\n"));
  process.exit(1);
}
console.log(`\n${scenarios.length} scenarios, all variants fair and consistent`);
