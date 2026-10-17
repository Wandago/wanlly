#!/usr/bin/env node
// Zero-dependency lint: every JS file parses, no stray debugging, and the rendered
// scenario docs match the scenario data (run `npm run render` to regenerate them).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (["node_modules", "data"].includes(f) ? [] : walk(p)) : [p];
});

for (const file of walk(root).filter((f) => /\.m?js$/.test(f))) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (e) {
    problems.push(`${file}: ${e.stderr.toString().trim()}`);
  }
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (new RegExp("\\bdebug" + "ger\\b").test(line)) problems.push(`${file}:${i + 1}: remove the stray breakpoint statement`);
    if (/\.innerHTML\s*=/.test(line)) problems.push(`${file}:${i + 1}: don't assign innerHTML; build nodes with textContent`);
  });
}

try {
  execFileSync(process.execPath, [join(root, "scripts/render-scenarios.js"), "--check"], { stdio: "pipe" });
} catch (e) {
  problems.push(e.stdout.toString().trim() || e.stderr.toString().trim());
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("lint ok");
