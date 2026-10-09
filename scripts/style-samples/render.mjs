// Renders each style sample page to public/styles/<id>.webp (the previews in the Design tool).
// Run: node scripts/style-samples/make-kinds.mjs, then npx -y -p playwright node scripts/style-samples/render.mjs   (needs Playwright's Chromium and ffmpeg)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../public/styles");
const tmp = join(here, ".png");
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
// Website looks sit in this folder; the other kinds in slides/, app/, codebase/ and system/.
const pages = [
  ...readdirSync(here).filter((f) => f.endsWith(".html")).map((f) => ["", f]),
  ...["slides", "app", "codebase", "system"].flatMap((k) => (existsSync(join(here, k)) ? readdirSync(join(here, k)).filter((f) => f.endsWith(".html")).map((f) => [k, f]) : [])),
];
for (const [kind, f] of pages) {
  const id = f.replace(/\.html$/, "");
  mkdirSync(join(out, kind), { recursive: true });
  await page.goto(`file://${join(here, kind, f)}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(f === "3d.html" ? 2500 : 400);
  const png = join(tmp, `${kind || "web"}-${id}.png`);
  await page.screenshot({ path: png });
  // 960×720 WebP: sharp on any screen at tile size, small to download.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", "scale=960:720:flags=lanczos", "-quality", "82", join(out, kind, `${id}.webp`)]);
  console.log(kind ? `${kind}/${id}` : id);
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
