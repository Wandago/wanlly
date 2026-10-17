#!/usr/bin/env node
// End-to-end playthrough in a real browser: two humans (desktop + phone) and two practice bots
// play a full case, then reconnect and rematch. Needs Playwright, which is not a dependency of
// the game: set PLAYWRIGHT_MODULE to its path, or install it globally. Without it, prints SKIP.
import { createApp } from "../server/index.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean);
let chromium;
for (const c of candidates) {
  try { ({ chromium } = await import(c)); break; } catch { /* try the next one */ }
}
if (!chromium) {
  console.log("SKIP e2e: Playwright not found (set PLAYWRIGHT_MODULE).");
  process.exit(0);
}

const { server } = createApp({ dataDir: mkdtempSync(join(tmpdir(), "mtaa-e2e-")) });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const shots = process.env.E2E_SCREENSHOTS;
const failures = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failures.push(what); };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const errors = [];
  const open = async (viewport, extra = {}) => {
    const page = await (await browser.newContext({ viewport, ...extra })).newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    return page;
  };
  const host = await open({ width: 1280, height: 900 });
  const guest = await open({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  const shot = async (p, name) => { if (shots) await p.screenshot({ path: join(shots, `${name}.png`) }); };

  await host.goto(BASE);
  await host.getByRole("button", { name: "Close" }).click();
  await host.locator("#create-name").fill("Amina");
  await host.getByRole("button", { name: "Create room" }).click();
  const code = (await host.locator(".room-code").textContent()).trim();
  check(/^[A-Z]{4}$/.test(code), `room created (${code})`);

  await guest.goto(`${BASE}/${code}`);
  await guest.getByRole("button", { name: "Close" }).click();
  await guest.locator("#join-name").fill("Otieno");
  await guest.getByRole("button", { name: "Join", exact: true }).click();
  await guest.getByText("Lobby").first().waitFor();
  for (let i = 0; i < 2; i++) await host.getByRole("button", { name: "Add practice bot" }).click();
  await host.getByText("Practice bot 2").waitFor();
  await shot(host, "lobby-desktop");
  await host.getByRole("button", { name: "Start the case" }).click();
  await host.locator(".phase-name", { hasText: "Briefing" }).waitFor();
  check(true, "case started");
  await shot(guest, "briefing-phone");

  const readyBoth = async (next) => {
    for (const p of [host, guest]) {
      const b = p.locator(".topbar").getByRole("button", { name: /^Ready/ });
      if (await b.count()) await b.click();
    }
    await host.locator(".phase-name", { hasText: next }).waitFor({ timeout: 5000 });
  };
  await readyBoth("Discovery");
  await guest.getByRole("tab", { name: /Board/ }).click();
  check(!(await guest.locator("#panel-card").isVisible()) && await guest.locator("#panel-board").isVisible(), "phone tabs show one panel at a time");
  check(await host.locator("#panel-card").isVisible() && await host.locator("#panel-board").isVisible(), "desktop shows all panels");

  for (const round of ["round 1", "round 2"]) {
    await readyBoth(round);
    await guest.getByRole("tab", { name: /Act/ }).click();
    for (const p of [host, guest]) {
      const btn = p.locator(".place .btn:not([disabled])").first();
      if (await btn.count()) await btn.click();
      await p.waitForTimeout(200);
    }
  }
  await shot(host, "investigate-desktop");
  await host.locator("#chat-input").fill("Where was everyone at 21:19?");
  await host.getByRole("button", { name: "Send" }).click();
  await guest.getByRole("tab", { name: /Chat/ }).click();
  await guest.getByText("Where was everyone at 21:19?").waitFor();
  check(true, "chat reaches the other player");

  await readyBoth("Closing arguments");
  await host.locator("#accuse-target").selectOption({ index: 1 });
  await host.getByRole("button", { name: "Accuse", exact: true }).click();
  await readyBoth("The vote");
  for (const p of [host, guest]) {
    await p.locator(".vote-grid .btn").first().click();
    await p.getByRole("button", { name: "Cast secret vote" }).click();
  }
  await host.locator(".phase-name", { hasText: "The truth" }).waitFor({ timeout: 5000 });
  const verdict = await host.locator(".verdict").textContent();
  check(/Caught|escaped/.test(verdict), `resolution reached: ${verdict}`);
  await shot(host, "results-desktop");

  await guest.reload();
  await guest.locator(".verdict").waitFor({ timeout: 5000 });
  check(true, "reload restores the seat and the results");
  check(!(await guest.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "no horizontal scroll on a 390px phone");

  await host.getByRole("button", { name: /Back to the lobby/ }).click();
  await host.getByText("Scores this session").waitFor();
  check(true, "rematch returns to the lobby with session scores");
  check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
} catch (e) {
  failures.push(e.message);
  console.log("FAIL " + e.message);
} finally {
  await browser.close();
  server.close();
}
process.exit(failures.length ? 1 : 0);
