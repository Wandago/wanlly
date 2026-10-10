/*
 * The Builder's preview: a project's files turned into one page for a sandboxed frame. Web apps
 * get their local CSS and scripts inlined (JavaScript modules importing each other work through
 * an import map); React apps have their components compiled in the page. Every preview reports
 * its errors to the Builder, which can hand them back to the AI to fix.
 */

export type BuildFile = { path: string; content: string };

/**
 * Posts runtime errors, rejected promises and console.error to the Builder (the parent page). An
 * empty src or href (a placeholder image, say) resolves to the page itself and is not reported.
 */
const REPORTER = `<script>(function(){function send(m){try{parent.postMessage({wanllyPreview:"error",message:String(m).slice(0,600)},"*")}catch(e){}}addEventListener("error",function(e){if(e.target&&e.target!==window&&(e.target.src||e.target.href)){var u=String(e.target.src||e.target.href);if(u.split("#")[0]===String(document.baseURI).split("#")[0])return;send("Couldn't load "+u);return}send((e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))},true);addEventListener("unhandledrejection",function(e){send("Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason))});var ce=console.error;console.error=function(){send([].map.call(arguments,String).join(" "));return ce.apply(console,arguments)};addEventListener("load",function(){parent.postMessage({wanllyPreview:"loaded"},"*")})})()</script>`;

/** In-memory storage and cookies for the sandboxed frame or published page, where the real ones throw. */
const STORAGE_SHIM = `<script>(function(){function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});try{document.cookie}catch(e){var c="";try{Object.defineProperty(document,"cookie",{get:function(){return c},set:function(v){c=String(v).split(";")[0]},configurable:true})}catch(_){}}})()</script>`;

const HEAD = STORAGE_SHIM + REPORTER;

const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "");
/** A path relative to `from`'s folder, as a project path; null when it points outside. */
function resolve(from: string, rel: string): string | null {
  if (/^[a-z]+:|^\/\//i.test(rel) || rel.startsWith("#") || rel.startsWith("data:")) return null;
  const parts = (rel.startsWith("/") ? rel.slice(1) : dirOf(from) + rel).split("/");
  const out: string[] = [];
  for (const s of parts) {
    if (s === "..") out.pop();
    else if (s && s !== ".") out.push(s);
  }
  return out.join("/").split(/[?#]/)[0];
}

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const scriptSafe = (s: string) => s.replace(/<\/script/gi, "<\\/script");

/** Which kind of preview a project gets, and from which file. */
export function previewKind(files: BuildFile[]): { kind: "html" | "react" | "none"; entry?: string } {
  const html = files.find((f) => f.path === "index.html") ?? files.find((f) => f.path.endsWith("/index.html")) ?? files.find((f) => f.path.endsWith(".html"));
  const app = files.find((f) => /(^|\/)App\.(jsx|tsx)$/.test(f.path)) ?? files.find((f) => /\.(jsx|tsx)$/.test(f.path));
  // A Vite-style React app (index.html loading src/main.jsx) runs as React: the browser can't
  // load .jsx itself.
  if (html && app && /<script\b[^>]*\bsrc\s*=\s*["'][^"']+\.(jsx|tsx)["']/i.test(html.content)) return { kind: "react", entry: app.path };
  if (html) return { kind: "html", entry: html.path };
  if (app) return { kind: "react", entry: app.path };
  return { kind: "none" };
}

/** The page the preview frame shows, or "" when the project has nothing a browser can run. */
export function buildPreview(files: BuildFile[]): string {
  const { kind, entry } = previewKind(files);
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  if (kind === "html" && entry) return htmlPage(entry, byPath);
  if (kind === "react" && entry) return reactPage(entry, files);
  return "";
}

/** Rewrites a module's relative imports to the import map's "project:" names. */
function rewriteImports(path: string, code: string, byPath: Map<string, string>) {
  return code.replace(/(\bimport\s*(?:[^'"()]*?\bfrom\s*)?|\bexport\s+[^'"()]*?\bfrom\s*|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+|\/[^'"]+)\2/g, (m, pre, q, spec) => {
    const target = resolve(path, spec);
    const found = target && (byPath.has(target) ? target : byPath.has(`${target}.js`) ? `${target}.js` : null);
    return found ? `${pre}${q}project:/${found}${q}` : m;
  });
}

function htmlPage(entry: string, byPath: Map<string, string>): string {
  let html = byPath.get(entry) ?? "";
  // Stylesheets: <link rel="stylesheet" href="styles.css"> becomes the file's CSS.
  html = html.replace(/<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const path = href && resolve(entry, href);
    return path && byPath.has(path) ? `<style>\n${byPath.get(path)}\n</style>` : tag;
  });
  // Modules: every local .js/.mjs file joins an import map, so they can import each other.
  const modules = [...byPath.keys()].filter((p) => /\.m?js$/.test(p));
  const usesModules = /<script\b[^>]*type\s*=\s*["']module["']/i.test(html);
  const map = usesModules
    ? `<script type="importmap">${JSON.stringify({ imports: Object.fromEntries(modules.map((p) => [`project:/${p}`, `data:text/javascript;base64,${b64(rewriteImports(p, byPath.get(p)!, byPath))}`])) })}</script>`
    : "";
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
    const path = resolve(entry, src);
    if (!path || !byPath.has(path)) return tag;
    const isModule = /type\s*=\s*["']module["']/i.test(a + b);
    return isModule ? `<script type="module">import "project:/${path}";</script>` : `<script>\n${scriptSafe(byPath.get(path)!)}\n</script>`;
  });
  // Inline modules may import project files too.
  html = html.replace(/<script\b([^>]*type\s*=\s*["']module["'][^>]*)>([\s\S]*?)<\/script>/gi, (tag, attrs, code) => (code.trim() ? `<script${attrs}>${rewriteImports(entry, code, byPath)}</script>` : tag));
  const head = HEAD + map;
  if (/<head(\s[^>]*)?>/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (m) => m + head);
  if (/<html(\s[^>]*)?>/i.test(html)) return html.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${head}</head>`);
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${html}</body></html>`;
}

/**
 * A React project in one page: components first, the entry last, with imports and exports
 * removed (they all share one scope), compiled by Babel and mounted. CSS files are added too.
 */
function reactPage(entry: string, files: BuildFile[]): string {
  const sources = files.filter((f) => /\.(jsx|tsx|js|ts)$/.test(f.path) && f.path !== entry && !/(^|\/)(main|index)\.(jsx|tsx|js|ts)$/.test(f.path) && !/\.(test|spec)\./.test(f.path));
  const strip = (code: string) =>
    code
      .replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "")
      .replace(/export\s+default\s+function/g, "function")
      .replace(/^export\s+default\s+[A-Z]\w*\s*;?\s*$/gm, "")
      .replace(/^export\s+(?=(const|let|function|class|async)\b)/gm, "");
  const app = files.find((f) => f.path === entry)!.content;
  const name = app.match(/export\s+default\s+function\s+([A-Z]\w*)/)?.[1] ?? app.match(/export\s+default\s+([A-Z]\w*)\s*;?/)?.[1] ?? "App";
  const code = [...sources.map((f) => `// ${f.path}\n${strip(f.content)}`), `// ${entry}\n${strip(app)}`].join("\n\n");
  const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
  const source = JSON.stringify(`const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;\n${code}\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(${name}));`).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${HEAD}
<script src="https://cdn.tailwindcss.com/3.4.16"></script>
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
<style>${css.replace(/<\/style/gi, "<\\/style")}</style>
</head>
<body>
<div id="root"></div>
<script>
try {
  var out = Babel.transform(${source}, { presets: [["typescript", { isTSX: true, allExtensions: true }], "react"] }).code;
  new Function(out)();
} catch (e) {
  console.error(String(e));
  document.getElementById("root").innerHTML = '<pre style="color:#b91c1c;white-space:pre-wrap;padding:16px;font:13px monospace"></pre>';
  document.querySelector("pre").textContent = String(e);
}
</script>
</body>
</html>`;
}
