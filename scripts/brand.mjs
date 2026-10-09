// Writes the Wanlly Spin brand files (public/brand) and the favicon (src/app/icon.svg) from
// the same geometry the app draws (src/lib/spin-mark.ts).
// Run: node --experimental-transform-types scripts/brand.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { spinMarkup } from "../src/lib/spin-mark.ts";

const ORANGE = "#ff5a1f";
const INK = "#0b0b0d";
const PAPER = "#fbfbfc";
const head = (vb) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="Wanlly"><title>Wanlly</title>`;
// The lowercase wordmark's outline, as drawn in the existing wordmark file.
const word = readFileSync("public/brand/wanlly-wordmark.svg", "utf8").match(/<path transform="([^"]+)" d="([^"]+)"/);
const wordPath = (fill, dx) => `<path transform="translate(${dx} 47) ${word[1].replace(/translate\([^)]*\)\s*/, "")}" d="${word[2]}" fill="${fill}"/>`;

const tile = (id) => `<rect width="64" height="64" rx="16" fill="${INK}"/>${spinMarkup({ id, color: ORANGE, r: 24 })}`;
const files = {
  "src/app/icon.svg": `${head("0 0 64 64")}${tile("wn")}</svg>`,
  "public/brand/wanlly-app-icon.svg": `${head("0 0 64 64")}${tile("wn")}</svg>`,
  "public/brand/wanlly-mark.svg": `${head("0 0 64 64")}${spinMarkup({ id: "wn", color: ORANGE, r: 29 })}</svg>`,
  "public/brand/wanlly-mark-reversed.svg": `${head("0 0 64 64")}${spinMarkup({ id: "wn", color: PAPER, r: 29 })}</svg>`,
  "public/brand/wanlly-logo.svg": `${head("0 0 238 64")}${tile("wn")}${wordPath("#15171c", 82)}</svg>`,
  "public/brand/wanlly-logo-reversed.svg": `${head("0 0 238 64")}${tile("wn")}${wordPath(PAPER, 82)}</svg>`,
};
for (const [path, svg] of Object.entries(files)) {
  writeFileSync(path, svg);
  console.log(path, svg.length);
}
