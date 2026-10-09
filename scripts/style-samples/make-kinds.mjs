// Writes the example pages for Slides, App screens, Codebase and Design system looks into
// slides/, app/, codebase/ and system/ (websites are the hand-made pages in this folder).
// Each style's colours, type and shapes come from TOKENS; the layouts are shared.
// Run: node scripts/style-samples/make-kinds.mjs && then render.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const TOKENS = {
  corporate: { fonts: "IBM+Plex+Serif:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600", display: "'IBM Plex Serif',serif", body: "'IBM Plex Sans',sans-serif", dw: 600, bg: "#ffffff", page: "#e8ecf2", surface: "#f6f7f9", ink: "#0b2a5b", text: "#1f2d45", muted: "#6b7a93", line: "#dfe3ea", accent: "#0b2a5b", accent2: "#c8a24a", on: "#fff", r: 8, brand: "Pamoja Bank Group" },
  editorial: { fonts: "Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600", display: "'Instrument Serif',serif", body: "'Inter Tight',sans-serif", dw: 400, bg: "#f2eee6", page: "#d9d3c7", surface: "#ebe5da", ink: "#1a1814", text: "#3a352d", muted: "#7a7266", line: "#cfc6b6", accent: "#9b2c1f", accent2: "#2f4a3a", on: "#fff", r: 0, italic: true, brand: "The Long Table" },
  swiss: { fonts: "Inter+Tight:wght@500;700;800;900", display: "'Inter Tight',sans-serif", body: "'Inter Tight',sans-serif", dw: 900, track: "-0.06em", bg: "#ffffff", page: "#e6e6e6", surface: "#f2f2f2", ink: "#111111", text: "#222", muted: "#666", line: "#111", accent: "#e30613", accent2: "#111111", on: "#fff", r: 0, brand: "Nairobi Design Week" },
  "dark-premium": { fonts: "Geist:wght@400;500;600;700&family=Geist+Mono:wght@500", display: "Geist,sans-serif", body: "Geist,sans-serif", dw: 600, track: "-0.05em", bg: "#09090b", page: "#1c1c20", surface: "#141417", ink: "#fafafa", text: "#d4d4d8", muted: "#8b8b94", line: "rgba(255,255,255,.1)", accent: "#bef264", accent2: "#a78bfa", on: "#09090b", r: 14, dark: true, glow: true, brand: "Relay" },
  playful: { fonts: "Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:wght@500;700", display: "'Bricolage Grotesque',sans-serif", body: "'DM Sans',sans-serif", dw: 800, track: "-0.05em", bg: "#fff6e5", page: "#ffd23f", surface: "#ffffff", ink: "#111111", text: "#222", muted: "#555", line: "#111", accent: "#ff5a36", accent2: "#2ec4b6", on: "#fff", r: 20, outline: true, brand: "chapa!" },
  minimal: { fonts: "Inter:wght@300;400;500", display: "Inter,sans-serif", body: "Inter,sans-serif", dw: 300, track: "-0.03em", bg: "#ffffff", page: "#ededeb", surface: "#f6f6f4", ink: "#111", text: "#333", muted: "#999", line: "#e6e6e6", accent: "#111111", accent2: "#bbbbbb", on: "#fff", r: 0, brand: "Wairimu Studio" },
  "afro-modern": { fonts: "Syne:wght@700;800&family=DM+Sans:wght@400;500;700", display: "Syne,sans-serif", body: "'DM Sans',sans-serif", dw: 800, track: "-0.04em", bg: "#f3e9d8", page: "#1d2554", surface: "#fbf4e8", ink: "#1d2554", text: "#2c3366", muted: "#5a5f80", line: "#d9c9ad", accent: "#c4532c", accent2: "#d9a441", on: "#fff", r: 18, pattern: true, brand: "Soko Collective" },
  luxury: { fonts: "Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500", display: "'Cormorant Garamond',serif", body: "Jost,sans-serif", dw: 400, bg: "#0f0d0b", page: "#2a241d", surface: "#17140f", ink: "#efe7da", text: "#d8cfc2", muted: "#9a8f80", line: "#3b3329", accent: "#d9c29a", accent2: "#8a6a52", on: "#0f0d0b", r: 0, dark: true, italic: true, brand: "Maison Lamu" },
  product: { fonts: "Inter:wght@400;500;600;700", display: "Inter,sans-serif", body: "Inter,sans-serif", dw: 700, track: "-0.03em", bg: "#ffffff", page: "#e4e4e7", surface: "#f4f4f5", ink: "#09090b", text: "#27272a", muted: "#71717a", line: "#e4e4e7", accent: "#16a34a", accent2: "#2563eb", on: "#fff", r: 10, brand: "Hesabu" },
  glass: { fonts: "Manrope:wght@500;600;700;800", display: "Manrope,sans-serif", body: "Manrope,sans-serif", dw: 800, track: "-0.04em", bg: "#0c1030", page: "#0c1030", surface: "rgba(255,255,255,.12)", ink: "#ffffff", text: "rgba(255,255,255,.85)", muted: "rgba(255,255,255,.6)", line: "rgba(255,255,255,.22)", accent: "#ffffff", accent2: "#00b8ff", on: "#0c1030", r: 22, dark: true, glass: true, brand: "aura" },
  organic: { fonts: "Fraunces:opsz,wght@9..144,400;9..144,600&family=Nunito+Sans:wght@400;600;700", display: "Fraunces,serif", body: "'Nunito Sans',sans-serif", dw: 600, track: "-0.03em", bg: "#f4efe3", page: "#c9d8b6", surface: "#fffaf0", ink: "#2d3b2a", text: "#3d4a39", muted: "#6b7867", line: "#e2dccb", accent: "#3e5a2e", accent2: "#b5653a", on: "#fff", r: 24, italic: true, brand: "Shamba Fresh" },
  kids: { fonts: "Baloo+2:wght@700;800&family=Nunito:wght@600;700;800", display: "'Baloo 2',sans-serif", body: "Nunito,sans-serif", dw: 800, bg: "#e9f6ff", page: "#ffd23f", surface: "#ffffff", ink: "#1b2b5b", text: "#3a4a78", muted: "#6a7aa0", line: "#c9d9ea", accent: "#ff7a00", accent2: "#00a86b", on: "#fff", r: 24, chunky: true, brand: "soma kids" },
};

const css = (t) => `@import url('https://fonts.googleapis.com/css2?family=${t.fonts}&display=swap');
*{box-sizing:border-box;margin:0}
:root{--bg:${t.bg};--page:${t.page};--surface:${t.surface};--ink:${t.ink};--text:${t.text};--muted:${t.muted};--line:${t.line};--accent:${t.accent};--accent2:${t.accent2};--on:${t.on};--r:${t.r}px;--d:${t.display};--b:${t.body};--dw:${t.dw};--tr:${t.track ?? "-0.02em"}}
body{width:1440px;height:1080px;overflow:hidden;background:var(--page);font-family:var(--b);color:var(--text);position:relative}
.disp{font-family:var(--d);font-weight:var(--dw);letter-spacing:var(--tr);color:var(--ink);line-height:.98}
.it{font-style:${t.italic ? "italic" : "normal"};color:var(--accent)}
.btn{display:inline-flex;align-items:center;justify-content:center;background:var(--accent);color:var(--on);font-weight:600;border-radius:${t.chunky ? 18 : t.r}px;${t.outline ? "border:3px solid #111;box-shadow:4px 4px 0 #111;" : ""}${t.chunky ? "box-shadow:0 5px 0 rgba(0,0,0,.18);" : ""}}
.btn.ghost{background:transparent;color:var(--ink);border:${t.outline ? 3 : 1}px solid ${t.outline ? "#111" : "var(--line)"};box-shadow:none}
.card{background:var(--surface);border-radius:var(--r);${t.outline ? "border:3px solid #111;box-shadow:6px 6px 0 #111;" : `border:1px solid var(--line);`}${t.glass ? "backdrop-filter:blur(18px);" : ""}}
.pattern{background:repeating-linear-gradient(90deg,var(--accent) 0 24px,var(--accent2) 24px 48px,var(--ink) 48px 72px)}
${t.glass ? ".blob{position:absolute;border-radius:50%;filter:blur(80px)}" : ""}`;

const blobs = (t) =>
  t.glass
    ? `<div class="blob" style="left:-100px;top:-120px;width:620px;height:620px;background:#6d4dff"></div><div class="blob" style="right:-80px;bottom:-140px;width:640px;height:640px;background:#00b8ff"></div><div class="blob" style="left:560px;top:420px;width:420px;height:420px;background:#ff4fa3;opacity:.6"></div>`
    : "";

/* ---------------- Slides: a title slide and two content slides, like a deck overview ---------------- */
const SLIDE_COPY = {
  corporate: ["2027 Strategy & Budget", "Board presentation · March 2027", "Revenue grew 18% to KES 34.1B", ["Grow SME lending", "Reach all 47 counties", "Cut cost-to-income below 45%"]],
  editorial: ["The future of Nairobi’s food markets", "A research report · Spring 2027", "6 in 10 traders now sell on WhatsApp", ["Markets are moving online", "Women run 70% of stalls", "Cold storage is the gap"]],
  swiss: ["Q3 Results", "07 numbers that matter", "Revenue up 31%", ["New markets: 3", "Team: 48 → 72", "Churn: 2.1%"]],
  "dark-premium": ["Relay · Series A", "Payments infrastructure for Africa", "KES 84M processed weekly", ["1,200 businesses live", "99.99% uptime", "4.2s median settlement"]],
  playful: ["Chapa! goes national", "Campus expansion plan · 2027", "12 → 40 campuses", ["Late-night menu", "Student riders", "M-Pesa only"]],
  minimal: ["Annual review", "2026 in twelve slides", "38 projects delivered", ["Schools", "Homes", "Clinics"]],
  "afro-modern": ["The Maker Fund", "Soko Collective · Investor update", "340 makers paid fairly", ["Fair prices", "47 counties", "Stories on every item"]],
  luxury: ["Season 2027", "Maison Lamu · Private presentation", "92% occupancy", ["Twelve suites", "Dhow arrivals", "A new rooftop terrace"]],
};

function slides(id) {
  const t = TOKENS[id];
  const [title, sub, big, points] = SLIDE_COPY[id];
  const deco = (scale) =>
    t.pattern ? `<div class="pattern" style="position:absolute;left:0;right:0;top:0;height:${7 * scale}%"></div>` :
    id === "swiss" ? `<div style="position:absolute;right:0;top:0;width:28%;height:46%;background:var(--accent)"></div>` :
    t.glow ? `<div style="position:absolute;left:50%;top:-40%;width:90%;height:90%;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(190,242,100,.2),transparent)"></div>` :
    id === "corporate" ? `<div style="position:absolute;left:0;top:0;bottom:0;width:2.2%;background:var(--accent2)"></div>` :
    id === "playful" ? `<div style="position:absolute;right:6%;bottom:10%;width:22%;aspect-ratio:1;border-radius:50%;background:var(--accent2);border:4px solid #111;transform:rotate(-8deg)"></div>` : "";
  const bars = [46, 58, 52, 70, 88].map((h, i) => `<i style="height:${h}%;${i === 4 ? "background:var(--accent)" : ""}"></i>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(t)}
.deck{position:absolute;inset:40px 60px;display:flex;flex-direction:column;gap:28px}
.s{position:relative;background:var(--bg);overflow:hidden;container-type:inline-size;aspect-ratio:16/9;box-shadow:0 20px 50px rgba(0,0,0,.18);border-radius:6px}
.main{width:100%;max-width:1180px;align-self:center}
.row{display:grid;grid-template-columns:1fr 1fr;gap:28px;max-width:1180px;width:100%;align-self:center}
.pad{position:absolute;inset:7cqw 7cqw}
.k{font:600 1.5cqw var(--b);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.t{font-size:7.4cqw;margin-top:2cqw;max-width:78%}
.sub{font-size:2.1cqw;color:var(--muted);margin-top:2.4cqw}
.foot{position:absolute;left:7cqw;right:7cqw;bottom:4cqw;display:flex;justify-content:space-between;font-size:1.4cqw;color:var(--muted)}
.big{font-size:6cqw}.chart{position:absolute;left:7cqw;right:7cqw;bottom:13cqw;height:30cqw;display:flex;align-items:flex-end;gap:3cqw;border-bottom:1px solid var(--line)}
.chart i{flex:1;background:${t.dark ? "rgba(255,255,255,.18)" : "var(--line)"};border-radius:${t.r ? "4px 4px 0 0" : "0"}}
.pts{margin-top:4cqw;display:grid;gap:2cqw}.pts div{display:flex;gap:2.4cqw;align-items:baseline;font-size:3cqw;color:var(--ink);border-top:1px solid var(--line);padding-top:2cqw}
.pts b{font-family:var(--d);color:var(--accent);font-size:3.4cqw;min-width:5cqw}
</style></head><body>${blobs(t)}
<div class="deck">
<section class="s main">${deco(1)}<div class="pad"><p class="k">${t.brand}</p><h1 class="disp t">${title.replace(/(\S+)$/, `<span class="it">$1</span>`)}</h1><p class="sub">${sub}</p></div><div class="foot"><span>${t.brand}</span><span>01</span></div></section>
<div class="row">
<section class="s">${deco(0.6)}<div class="pad"><p class="k">Highlights</p><h2 class="disp big" style="margin-top:2cqw">${big}</h2></div><div class="chart">${bars}</div><div class="foot"><span>Source: internal data</span><span>02</span></div></section>
<section class="s"><div class="pad"><p class="k">Priorities</p><div class="pts">${points.map((p, i) => `<div><b>0${i + 1}</b>${p}</div>`).join("")}</div></div><div class="foot"><span>${t.brand}</span><span>03</span></div></section>
</div></div></body></html>`;
}

/* ---------------- App screens: three phones ---------------- */
const APP_COPY = {
  product: { title: "Today", money: "KES 48,250", label: "Sales today", rows: [["Cement × 4", "KES 4,860"], ["Paint 4L", "KES 2,300"], ["Iron sheets × 6", "KES 7,800"]], cta: "New sale", tabs: ["Home", "Sales", "Stock", "Me"] },
  "dark-premium": { title: "Wallet", money: "KES 186,400", label: "Available balance", rows: [["M-Pesa top-up", "+ KES 5,000"], ["Card payout", "− KES 12,000"], ["Invoice #2044", "+ KES 48,000"]], cta: "Send money", tabs: ["Home", "Cards", "Pay", "Me"] },
  playful: { title: "Hungry?", money: "KES 150", label: "Chapati wrap", rows: [["Chai + 2 mandazi", "KES 90"], ["Smocha", "KES 120"], ["Fries & sausage", "KES 200"]], cta: "Order now", tabs: ["Menu", "Orders", "Deals", "Me"] },
  glass: { title: "Savings", money: "KES 186,400", label: "Total savings", rows: [["Chama: Mama Mboga", "73%"], ["School fees", "41%"], ["Emergency", "90%"]], cta: "Add money", tabs: ["Home", "Goals", "Groups", "Me"] },
  organic: { title: "This week’s box", money: "KES 1,200", label: "Family box", rows: [["Sukuma wiki", "2 bunches"], ["Tomatoes", "1 kg"], ["Avocados", "4 pcs"]], cta: "Confirm box", tabs: ["Box", "Farms", "Recipes", "Me"] },
  kids: { title: "Story time!", money: "Level 4", label: "Reading stars ★ 26", rows: [["Simba’s big day", "5 min"], ["The rain song", "4 min"], ["Mama’s market", "6 min"]], cta: "Read ▶", tabs: ["Read", "Play", "Stars", "Me"] },
};

function app(id) {
  const t = TOKENS[id];
  const c = APP_COPY[id];
  const screen = (n) => {
    const head = `<div class="st"><span>9:41</span><span>● ● ●</span></div>`;
    const nav = `<div class="nav">${c.tabs.map((x, i) => `<span style="${i === 0 ? "color:var(--accent);font-weight:700" : ""}">${x}</span>`).join("")}</div>`;
    if (n === 0)
      return `${head}<p class="k">${t.brand}</p><h1 class="disp" style="font-size:44px;margin:6px 0 18px">${c.title}</h1>
<div class="card hero" style="${id === "dark-premium" || id === "product" ? "" : ""}"><small>${c.label}</small><b class="disp" style="font-size:36px">${c.money}</b><span class="btn" style="padding:12px 18px;margin-top:14px">${c.cta}</span></div>
<div class="list">${c.rows.map(([a, b]) => `<div class="li"><i></i><span>${a}</span><em>${b}</em></div>`).join("")}</div>${nav}`;
    if (n === 1)
      return `${head}<p class="k">Details</p><h1 class="disp" style="font-size:36px;margin:6px 0 16px">${c.rows[0][0]}</h1>
<div class="card" style="height:250px;display:grid;place-items:center"><svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="60" fill="none" stroke="var(--line)" stroke-width="16"/><circle cx="75" cy="75" r="60" fill="none" stroke="var(--accent)" stroke-width="16" stroke-dasharray="377" stroke-dashoffset="110" stroke-linecap="round" transform="rotate(-90 75 75)"/><text x="75" y="84" text-anchor="middle" font-size="28" font-weight="700" fill="var(--ink)" font-family="${t.display.replace(/'/g, "")}">71%</text></svg></div>
<div class="list" style="margin-top:16px">${c.rows.slice(1).map(([a, b]) => `<div class="li"><i></i><span>${a}</span><em>${b}</em></div>`).join("")}</div><span class="btn" style="width:100%;padding:16px;margin-top:18px">${c.cta}</span>`;
    return `${head}<p class="k">Done</p><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px"><span style="width:110px;height:110px;border-radius:50%;background:var(--accent);display:grid;place-items:center;color:var(--on);font-size:52px;${t.outline ? "border:3px solid #111;box-shadow:5px 5px 0 #111" : ""}">✓</span><h1 class="disp" style="font-size:38px">All set!</h1><p style="color:var(--muted);max-width:240px">We’ll send an M-Pesa confirmation in a moment.</p></div><span class="btn ghost" style="width:100%;padding:15px">Back home</span>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(t)}
body{display:flex;align-items:center;justify-content:center;gap:56px}
.ph{position:relative;width:380px;height:800px;border-radius:56px;background:${t.dark ? "#000" : "#111"};padding:14px;box-shadow:0 40px 80px rgba(0,0,0,.25)}
.ph:nth-child(even){transform:translateY(40px)}
.sc{height:100%;border-radius:44px;background:var(--bg);padding:20px 22px 0;display:flex;flex-direction:column;overflow:hidden;position:relative}
.st{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:16px}
.k{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.hero{padding:22px;display:flex;flex-direction:column;align-items:flex-start;gap:4px}${id === "dark-premium" || id === "product" ? "" : ""}
.hero small{color:var(--muted);font-weight:600}
.list{display:flex;flex-direction:column;gap:10px;margin-top:18px}
.li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:calc(var(--r) * .8);background:var(--surface);${t.outline ? "border:2.5px solid #111;" : `border:1px solid var(--line);`}color:var(--ink);font-weight:600;font-size:15px}
.li i{width:34px;height:34px;border-radius:${t.r ? "10px" : "0"};background:var(--accent2);opacity:.85;flex:none}
.li em{margin-left:auto;font-style:normal;color:var(--muted);font-size:14px}
.nav{margin-top:auto;display:flex;justify-content:space-between;padding:16px 8px 26px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
</style></head><body>${blobs(t)}
${[0, 1, 2].map((n) => `<div class="ph"><div class="sc">${screen(n)}</div></div>`).join("")}
</body></html>`;
}

/* ---------------- Codebase: component code beside the rendered components ---------------- */
function codebase(id) {
  const t = TOKENS[id];
  const code = `<span class="c">// components/pricing-card.tsx</span>
<span class="k">export function</span> <span class="f">PricingCard</span>({ plan }) {
  <span class="k">return</span> (
    &lt;<span class="f">Card</span> className=<span class="s">"p-6"</span>&gt;
      &lt;<span class="f">Badge</span>&gt;{plan.tag}&lt;/<span class="f">Badge</span>&gt;
      &lt;h3 className=<span class="s">"text-2xl font-semibold"</span>&gt;
        {plan.name}
      &lt;/h3&gt;
      &lt;p className=<span class="s">"text-4xl"</span>&gt;KES {plan.price}&lt;/p&gt;
      &lt;<span class="f">Button</span> size=<span class="s">"lg"</span>&gt;Choose plan&lt;/<span class="f">Button</span>&gt;
    &lt;/<span class="f">Card</span>&gt;
  );
}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(t)}
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&display=swap');
body{display:grid;grid-template-columns:600px 1fr;gap:0;background:var(--page)}
.ed{background:#0d0f14;color:#c9ccd3;padding:0;display:flex;flex-direction:column}
.tabs{display:flex;gap:2px;background:#07080b;padding:12px 12px 0}.tabs span{padding:10px 16px;font:500 13px 'Geist Mono';color:#7a7f8c;border-radius:8px 8px 0 0}.tabs span.on{background:#0d0f14;color:#e5e7eb}
pre{padding:34px 34px;font:400 18px/1.9 'Geist Mono',monospace;white-space:pre}
.c{color:#5c6370}.k{color:#c678dd}.f{color:#61afef}.s{color:#98c379}
.term{margin-top:auto;border-top:1px solid #1f232b;padding:18px 30px;font:400 14px/1.7 'Geist Mono';color:#7a7f8c}.term b{color:#98c379;font-weight:400}
.pv{background:var(--bg);padding:64px 60px;display:flex;flex-direction:column;justify-content:center;gap:40px;position:relative;overflow:hidden}
.lab{font:600 14px var(--b);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.pc{padding:36px;display:flex;flex-direction:column;gap:14px;align-items:flex-start;font-size:18px}
.badge{font-size:14px;font-weight:700;padding:5px 12px;border-radius:999px;background:var(--accent2);color:${t.dark ? "#09090b" : "#fff"};${t.outline ? "border:2px solid #111;" : ""}}
.pc h3{font:var(--dw) 32px var(--d);color:var(--ink);letter-spacing:var(--tr)}
.pc .p{font:var(--dw) 56px var(--d);color:var(--ink);letter-spacing:var(--tr);white-space:nowrap}.pc .p small{font:500 16px var(--b);color:var(--muted)}
.pc ul{list-style:none;padding:0;display:grid;gap:6px;color:var(--text);margin:6px 0 10px}.pc li::before{content:"✓  ";color:var(--accent)}
.feat{border:2px solid var(--accent)}
.row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.inp{flex:1;min-width:240px;padding:18px 20px;font-size:17px;border-radius:var(--r);border:${t.outline ? "3px solid #111" : "1px solid var(--line)"};background:var(--surface);color:var(--muted)}
</style></head><body>
<div class="ed"><div class="tabs"><span class="on">pricing-card.tsx</span><span>button.tsx</span><span>tailwind.config.ts</span></div><pre>${code}</pre><div class="term">$ npm run dev<br><b>✓</b> Ready on http://localhost:3000</div></div>
<div class="pv">${blobs(t)}<p class="lab" style="position:relative">Preview · ${t.brand}</p>
<div class="cards" style="position:relative"><div class="card pc"><span class="badge">Starter</span><h3>Basic</h3><p class="p">KES 0 <small>/ month</small></p><ul><li>3 projects</li><li>Community support</li></ul><span class="btn ghost" style="padding:15px 24px;font-size:17px">Start free</span></div>
<div class="card pc feat"><span class="badge">Popular</span><h3>Pro</h3><p class="p">KES 900 <small>/ month</small></p><ul><li>Unlimited projects</li><li>Priority support</li></ul><span class="btn" style="padding:15px 24px;font-size:17px">Choose plan</span></div></div>
<p class="lab" style="position:relative">Buttons & inputs</p>
<div class="row" style="position:relative"><span class="btn" style="padding:16px 28px;font-size:18px">Primary</span><span class="btn ghost" style="padding:16px 28px;font-size:18px">Secondary</span><span class="badge" style="font-size:16px">Badge</span></div>
<div class="row" style="position:relative"><span class="inp">you@example.co.ke</span><span class="btn" style="padding:18px 26px;font-size:17px">Subscribe</span></div>
</div></body></html>`;
}

/* ---------------- Design system: tokens sheet ---------------- */
function system(id) {
  const t = TOKENS[id];
  const sw = [["Ink", t.ink], ["Accent", t.accent], ["Accent 2", t.accent2], ["Surface", t.surface], ["Background", t.bg], ["Line", t.line]];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(t)}
body{background:var(--bg);padding:56px 72px;display:grid;grid-template-columns:1.1fr .9fr;grid-template-rows:auto 1fr;gap:40px 64px;font-size:18px}
${t.pattern ? "body::before{content:'';position:absolute;left:0;right:0;top:0;height:18px;background:repeating-linear-gradient(90deg,var(--accent) 0 24px,var(--accent2) 24px 48px,var(--ink) 48px 72px)}" : ""}
header{grid-column:1/3;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px;position:relative}
header h1{font-size:84px}header p{color:var(--muted)}
.lab{font:600 14px var(--b);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:16px}
.sw{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.sw div{border-radius:var(--r);overflow:hidden;border:${t.outline ? "3px solid #111" : "1px solid var(--line)"};background:var(--surface)}
.sw i{display:block;height:130px}.sw p{padding:12px 14px;font-size:16px;color:var(--ink);font-weight:600}.sw small{display:block;color:var(--muted);font-weight:400;font-family:monospace}
.ts{display:flex;flex-direction:column;gap:14px;margin-top:40px}
.ts div{display:flex;align-items:baseline;gap:18px;border-top:1px solid var(--line);padding-top:10px}.ts small{width:80px;color:var(--muted);font-size:12px;font-family:monospace}
.comp{display:flex;flex-direction:column;gap:34px;position:relative}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.inp{display:block;width:100%;padding:18px 20px;font-size:18px;border-radius:var(--r);border:${t.outline ? "3px solid #111" : "1px solid var(--line)"};background:var(--surface);color:var(--muted)}
.chk{display:flex;gap:10px;align-items:center;color:var(--ink)}.chk i{width:28px;height:28px;border-radius:${t.r ? 6 : 0}px;background:var(--accent);display:grid;place-items:center;color:var(--on);font-style:normal;font-size:14px}
.alert{padding:22px 24px;font-size:18px;border-radius:var(--r);border-left:4px solid var(--accent);background:var(--surface);color:var(--ink)}
.badge{font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px;background:var(--accent2);color:${t.dark ? "#09090b" : "#fff"}}
.rad{display:flex;gap:14px}.rad span{width:76px;height:76px;border:2px solid var(--accent);background:var(--surface)}
</style></head><body>${blobs(t)}
<header><div><p class="lab">Design system · v1.0</p><h1 class="disp">${t.brand}</h1></div><p>Colours, type and components</p></header>
<section style="position:relative"><p class="lab">Colour</p><div class="sw">${sw.map(([n, c]) => `<div><i style="background:${c}"></i><p>${n}<small>${c}</small></p></div>`).join("")}</div>
<div class="ts"><p class="lab" style="margin:0">Type scale</p>
<div><small>Display</small><span class="disp" style="font-size:76px">Build boldly</span></div>
<div><small>Heading</small><span class="disp" style="font-size:44px">Section heading</span></div>
<div><small>Body</small><span style="font-size:20px;color:var(--text)">Body text reads clearly at 16–18px.</span></div></div></section>
<section class="comp"><div><p class="lab">Buttons</p><div class="row"><span class="btn" style="padding:17px 28px;font-size:18px">Primary</span><span class="btn ghost" style="padding:17px 28px;font-size:18px">Secondary</span><span class="badge" style="font-size:15px">New</span></div></div>
<div><p class="lab">Input</p><span class="inp">Phone number · 07XX XXX XXX</span></div>
<div class="chk"><i>✓</i>Remember me on this device</div>
<div class="alert"><b>Payment received.</b> KES 2,500 via M-Pesa.</div>
<div><p class="lab">Radius</p><div class="rad"><span style="border-radius:0"></span><span style="border-radius:${Math.max(4, t.r / 2)}px"></span><span style="border-radius:${t.r}px"></span><span style="border-radius:999px"></span></div></div></section>
</body></html>`;
}

export const KINDS = {
  slides: { ids: ["corporate", "editorial", "swiss", "dark-premium", "playful", "minimal", "afro-modern", "luxury"], make: slides },
  app: { ids: ["product", "dark-premium", "playful", "glass", "organic", "kids"], make: app },
  codebase: { ids: ["product", "dark-premium", "minimal", "playful"], make: codebase },
  system: { ids: ["corporate", "product", "playful", "afro-modern"], make: system },
};

for (const [kind, { ids, make }] of Object.entries(KINDS)) {
  const dir = join(here, kind);
  mkdirSync(dir, { recursive: true });
  for (const id of ids) writeFileSync(join(dir, `${id}.html`), make(id));
  console.log(kind, ids.length);
}
