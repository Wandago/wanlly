// Draws the picture shown when a Wanlly link is shared (src/app/opengraph-image.png, 1200×630).
// Run: node --experimental-transform-types scripts/og.mjs   (needs Playwright, local or global)
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { spinMarkup } from "../src/lib/spin-mark.ts";

const { chromium } = await import("playwright").catch(() => createRequire(`${execSync("npm root -g").toString().trim()}/`)("playwright"));

const ORANGE = "#ff5a1f";
const word = readFileSync("public/brand/wanlly-wordmark.svg", "utf8").match(/<path transform="([^"]+)" d="([^"]+)"/);
const logo = `<svg viewBox="0 0 238 64" height="64"><rect width="64" height="64" rx="16" fill="#1a1b20"/>${spinMarkup({ id: "og", color: ORANGE, r: 24 })}<path transform="translate(82 47) ${word[1].replace(/translate\([^)]*\)\s*/, "")}" d="${word[2]}" fill="#fbfbfc"/></svg>`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Geist:wght@400;500&display=swap">
<style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0b0b0d;color:#fbfbfc;font-family:Geist,system-ui,sans-serif;padding:72px 80px;display:flex;flex-direction:column;position:relative;overflow:hidden}
h1{font-family:"Bricolage Grotesque",sans-serif;font-weight:700;font-size:84px;line-height:.98;letter-spacing:-.045em;margin-top:auto;max-width:900px}
h1 i{font-style:normal;color:${ORANGE}}
p{margin-top:28px;font-size:28px;color:#a7a9b2;max-width:820px;line-height:1.35}
.chips{display:flex;gap:12px;margin-top:40px}
.chips span{border:1.5px solid #2a2c33;border-radius:999px;padding:10px 22px;font-size:22px;font-weight:500;color:#e6e7ea}
.mark{position:absolute;right:-200px;top:-150px;opacity:.08}
body>svg:not(.mark){align-self:flex-start}
</style></head><body>
<svg class="mark" viewBox="0 0 64 64" width="560" height="560">${spinMarkup({ id: "big", color: ORANGE, r: 29 })}</svg>
${logo}
<h1>Frontier AI for everyone with an idea<i>.</i></h1>
<p>Chat, code and design with top AI models. No card, no subscription: sponsors pay, you build.</p>
<div class="chips"><span>Chat</span><span>Code</span><span>Design</span></div>
</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "src/app/opengraph-image.png" });
await browser.close();
console.log("src/app/opengraph-image.png");
