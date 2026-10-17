import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.js";
import { loadScenarios } from "../server/scenario.js";

let app, base;
before(async () => {
  app = createApp({ dataDir: mkdtempSync(join(tmpdir(), "mtaa-")) });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => app.server.close());

const post = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));

async function firstEvent(path) {
  const ctrl = new AbortController();
  const res = await fetch(base + path, { signal: ctrl.signal });
  const reader = res.body.getReader();
  let buf = "";
  for (;;) {
    const { value } = await reader.read();
    buf += new TextDecoder().decode(value);
    const m = /data: (.*)\n\n/.exec(buf);
    if (m) { ctrl.abort(); return JSON.parse(m[1]); }
  }
}

test("serves the client with security headers", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(await r.text(), /<title>Mtaa Mysteries<\/title>/);
  assert.equal((await fetch(base + "/BCDF")).status, 200, "room links load the app");
});

test("never serves scenario files or anything outside the client folder", async () => {
  for (const p of ["/scenarios/01-mwangaza-court.json", "/../scenarios/01-mwangaza-court.json", "/%2e%2e/server/game.js", "/server/game.js", "/package.json"]) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});

test("the scenario list is public metadata with no solutions", async () => {
  const list = await (await fetch(base + "/api/scenarios")).json();
  assert.equal(list.length, 6);
  const json = JSON.stringify(list);
  for (const s of loadScenarios()) {
    assert.ok(!json.includes(s.solution.summary.slice(0, 30)));
    assert.ok(!json.includes(s.culprit.truth.slice(0, 30)));
  }
});

test("create, join, stream and play through the API", async () => {
  const host = await post("/api/rooms", { name: "Achieng'" });
  assert.equal(host.status, 200);
  const guest = await post(`/api/rooms/${host.body.code}/join`, { name: "Kamau" });
  assert.equal(guest.status, 200);
  assert.equal((await post(`/api/rooms/${host.body.code}/join`, { name: "x" })).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await post(`/api/rooms/${host.body.code}/act`, { token: host.body.token, type: "addBot" })).status, 200);
  assert.equal((await post(`/api/rooms/${host.body.code}/act`, { token: guest.body.token, type: "start" })).status, 400);
  assert.equal((await post(`/api/rooms/${host.body.code}/act`, { token: host.body.token, type: "start" })).status, 200);
  const view = await firstEvent(`/api/rooms/${host.body.code}/stream?token=${host.body.token}`);
  assert.equal(view.game.phase, "briefing");
  assert.ok(view.game.me.secret);
  assert.equal(view.people.length, 4);
  const bad = await firstEvent(`/api/rooms/${host.body.code}/stream?token=nope`);
  assert.deepEqual(bad, { removed: "unknown" });
});

test("rejects oversized and malformed bodies", async () => {
  const big = await fetch(base + "/api/rooms", { method: "POST", body: JSON.stringify({ name: "x".repeat(10_000) }) });
  assert.equal(big.status, 413);
  const junk = await fetch(base + "/api/rooms", { method: "POST", body: "{not json" });
  assert.equal(junk.status, 400);
});
