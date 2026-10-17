// HTTP server: static client, a small JSON API, and Server-Sent Events for live state.
// No dependencies beyond Node itself. Scenarios (which contain solutions) are never served.
import { createServer } from "node:http";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { join, dirname, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarios, validateAll } from "./scenario.js";
import { Rooms } from "./rooms.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "client");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const SECURITY = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function createApp({ dataDir = join(ROOT, "data"), scenarios = loadScenarios() } = {}) {
  const problems = validateAll(scenarios);
  if (problems.length) throw new Error("Scenario checks failed:\n" + problems.join("\n"));

  const rooms = new Rooms(scenarios, {
    onReport: async (r) => {
      await mkdir(dataDir, { recursive: true });
      await appendFile(join(dataDir, "reports.jsonl"), JSON.stringify(r) + "\n");
    },
  });
  const buckets = new Map(); // token -> { n, reset }

  const limited = (key, max = 30) => {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || now > b.reset) { buckets.set(key, { n: 1, reset: now + 5000 }); return false; }
    return ++b.n > max;
  };

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...SECURITY, ...headers });
    res.end(JSON.stringify(body));
  };

  // Resolves to the parsed JSON, null for malformed JSON, or "too-large" past 8 KB.
  const readBody = (req) => new Promise((resolve) => {
    let size = 0, data = "";
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= 8192) data += chunk;
      else if (size > 1_000_000) { resolve("too-large"); req.destroy(); } // stop reading abusive uploads
    });
    req.on("end", () => {
      if (size > 8192) return resolve("too-large");
      try { resolve(JSON.parse(data || "{}")); } catch { resolve(null); }
    });
  });
  const badBody = (res, body) => send(res, body === "too-large" ? 413 : 400, { error: body === "too-large" ? "Request too large." : "Bad request." });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    try {
      if (req.method === "GET" && path === "/api/scenarios") return send(res, 200, rooms.scenarioList());
      if (req.method === "GET" && path === "/api/rooms") return send(res, 200, rooms.publicRooms());
      if (req.method === "POST" && path === "/api/rooms") {
        if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "Too many requests." });
        const body = await readBody(req);
        if (!body || body === "too-large") return badBody(res, body);
        const r = rooms.create(body.name, { isPublic: body.isPublic });
        return send(res, r.error ? 400 : 200, r);
      }
      let m = /^\/api\/rooms\/([A-Za-z]{4})\/(join|act|stream|pos)$/.exec(path);
      if (m) {
        const [, code, what] = m;
        if (what === "join" && req.method === "POST") {
          if (limited(req.socket.remoteAddress)) return send(res, 429, { error: "Too many requests." });
          const body = await readBody(req);
          if (!body || body === "too-large") return badBody(res, body);
          const r = rooms.join(code, body.name);
          return send(res, r.error ? 400 : 200, r);
        }
        if (what === "pos" && req.method === "POST") {
          const body = await readBody(req);
          if (!body || body === "too-large" || !body.token) return badBody(res, body);
          if (limited("pos:" + body.token, 120)) return send(res, 429, { error: "Too many moves." });
          const r = rooms.move(code, body.token, body.x, body.y);
          return send(res, r.ok ? 200 : 409, r);
        }
        if (what === "act" && req.method === "POST") {
          const body = await readBody(req);
          if (!body || body === "too-large" || !body.token) return badBody(res, body);
          if (limited(body.token)) return send(res, 429, { error: "Slow down a little." });
          const { token, ...action } = body;
          const r = rooms.action(code, token, action);
          return send(res, r.error ? 400 : 200, r);
        }
        if (what === "stream" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", ...SECURITY });
          res.write("retry: 2000\n\n");
          const push = (body, event) => res.write(`${event ? `event: ${event}\n` : ""}data: ${body}\n\n`);
          const off = rooms.connect(code, url.searchParams.get("token"), push);
          if (!off) { push(JSON.stringify({ removed: "unknown" })); return res.end(); }
          const ping = setInterval(() => res.write(": ping\n\n"), 20_000);
          req.on("close", () => { clearInterval(ping); off(); });
          return;
        }
      }
      if (req.method === "GET") {
        const rel = path === "/" || /^\/[A-Za-z]{4}$/.test(path) ? "index.html" : path.slice(1);
        const file = normalize(join(CLIENT, rel));
        if (!file.startsWith(CLIENT + "/") || !TYPES[extname(file)]) return send(res, 404, { error: "Not found." });
        const body = await readFile(file).catch(() => null);
        if (!body) return send(res, 404, { error: "Not found." });
        res.writeHead(200, { "Content-Type": TYPES[extname(file)], "Cache-Control": "no-cache", ...SECURITY });
        return res.end(body);
      }
      return send(res, 405, { error: "Method not allowed." });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) send(res, 500, { error: "Server error." });
    }
  });

  const timer = setInterval(() => {
    const now = Date.now();
    rooms.tickAll(now);
    for (const [key, b] of buckets) if (now > b.reset) buckets.delete(key);
  }, 1000);
  const fast = setInterval(() => rooms.fastTick(Date.now()), 100);
  server.on("close", () => { clearInterval(timer); clearInterval(fast); });
  return { server, rooms };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8080);
  const { server } = createApp({ dataDir: process.env.DATA_DIR });
  server.listen(port, () => console.log(`Mtaa Mysteries on http://localhost:${port}`));
}
