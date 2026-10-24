// Renders an ad page (docs/ads/sign-ad.html by default) into MP4 (sharp, 2x pixels) and GIF (the size
// itself) for every banner size: node docs/ads/render-sign.mjs [out-dir] [sizes] [page] [name].
// Needs Playwright's Chromium and ffmpeg.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const PW = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(PW);
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || "public/ads/sign");
const sizes = (process.argv[3] || "300x600,160x600,336x280,300x250,728x90,468x60,320x100,320x50").split(",");
const PAGE = process.argv[4] || "sign-ad.html";
const NAME = process.argv[5] || "wanlly-sign";
const FPS = 25;
const SECONDS = 10;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const size of sizes) {
  const [w, h] = size.split("x").map(Number);
  const frames = fs.mkdtempSync(path.join(out, `.frames-${size}-`));
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto(`file://${path.join(here, PAGE)}?size=${size}`);
  await page.evaluate(() => window.ready);
  await page.waitForTimeout(400);
  for (let i = 0; i < FPS * SECONDS; i++) {
    await page.evaluate((t) => window.seek(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, "0")}.png`) });
  }
  await page.close();
  const name = path.join(out, `${NAME}-${size}`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"), "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${name}.mp4`]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(frames, "f%04d.png"), "-vf", `fps=12,scale=${w}:${h}:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, "-loop", "0", `${name}.gif`]);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(size, fs.statSync(`${name}.mp4`).size, fs.statSync(`${name}.gif`).size);
}
await browser.close();
