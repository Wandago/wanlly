// Renders each style sample page to public/styles/<id>.webp (the previews in the Design tool).
// Run: npx -y -p playwright node scripts/style-samples/render.mjs   (needs Playwright's Chromium and ffmpeg)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../public/styles");
const tmp = join(here, ".png");
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
for (const f of readdirSync(here).filter((f) => f.endsWith(".html"))) {
  const id = f.replace(/\.html$/, "");
  await page.goto(`file://${join(here, f)}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(f === "3d.html" ? 2500 : 400);
  const png = join(tmp, `${id}.png`);
  await page.screenshot({ path: png });
  // 960×720 WebP: sharp on any screen at tile size, small to download.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", "scale=960:720:flags=lanczos", "-quality", "82", join(out, `${id}.webp`)]);
  console.log(id);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
