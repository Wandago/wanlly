/*
 * Turns code in a reply into one HTML file that runs on its own: a full page, separate HTML, CSS
 * and JavaScript files stitched together, or a React component with React and a JSX compiler
 * loaded from a CDN. Used for the live canvas and for "Download .html". Works on a reply that is
 * still streaming, so the canvas can show the page as it's written.
 */

export type Block = { lang: string; name: string; code: string; closed: boolean };
export type Project = { kind: "html" | "react"; title: string; html: string; files: Block[]; complete: boolean };
/** Code that needs a server or a toolchain to run (Flask, Express, PHP…): downloaded as files. */
export type ServerProject = { kind: "server"; title: string; stack: string; files: { name: string; code: string }[]; complete: boolean };

/** Template tags that a server fills in: Jinja/Django, EJS, PHP, Handlebars blocks. */
const TEMPLATE = /\{%[\s\S]*?%\}|<%[\s\S]*?%>|<\?php|\{\{\s*(url_for|request\.|form\.|csrf_token|#each|#if)/;

const FENCE = /(^|\n)```([\w+#.-]*)[^\n]*\n([\s\S]*?)(\n```|$(?![\s\S]))/g;
/** A line that is only a file name, e.g. "index.html", "**app.py**", "`style.css`", "File: src/x.ts". */
const NAME = /^[\s`*#>_-]*(?:file(?:name)?:\s*)?([\w./-]+\.[A-Za-z0-9]{1,8})[\s`*:_]*$/i;

/** Fenced code blocks, each with the file name written on the line before it, if any. */
export function codeBlocks(md: string): Block[] {
  const out: Block[] = [];
  for (const m of md.matchAll(FENCE)) {
    const before = md.slice(0, m.index! + m[1].length).trimEnd().split("\n").pop() ?? "";
    const firstLine = m[3].split("\n")[0];
    const named = before.match(NAME)?.[1] ?? firstLine.match(/^\s*(?:\/\/|<!--|\/\*)\s*(?:file:\s*)?([\w./-]+\.\w+)/i)?.[1] ?? "";
    out.push({ lang: m[2].toLowerCase(), name: named.split("/").pop() ?? "", code: m[3], closed: m[4] !== "" });
  }
  return out;
}

const isHtml = (b: Block) => b.lang === "html" || b.lang === "htm" || /\.html?$/i.test(b.name) || (!b.lang && /^\s*<(!doctype|html)/i.test(b.code));
const isCss = (b: Block) => b.lang === "css" || /\.css$/i.test(b.name);
const isJs = (b: Block) => ["js", "javascript", "mjs"].includes(b.lang) || /\.m?js$/i.test(b.name);
const isJsx = (b: Block) => ["jsx", "tsx", "react"].includes(b.lang) || /\.(jsx|tsx)$/i.test(b.name);
/** Server code that can't run in a browser. */
const isServer = (code: string) => /\brequire\(|from ['"](express|fs|path|http|node:)|process\.env|app\.listen\(/.test(code);

function titleOf(html: string, fallback: string) {
  return html.match(/<title[^>]*>([^<]{1,80})/i)?.[1].trim() || html.match(/<h1[^>]*>([^<]{1,80})/i)?.[1].trim() || fallback;
}

/** Inserts `add` before the closing tag, or at the end when the page is partial. */
const before = (html: string, tag: "head" | "body", add: string) => {
  const re = new RegExp(`</${tag}>`, "i");
  if (re.test(html)) return html.replace(re, `${add}</${tag}>`);
  if (tag === "head" && /<body/i.test(html)) return html.replace(/<body/i, `${add}<body`);
  return html + add;
};

function stitch(page: Block, css: Block[], js: Block[]): string {
  let html = page.code;
  if (!/<html|<body|<!doctype/i.test(html)) html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
  // Linked files that were written out in the reply are put inline, so one file runs anywhere.
  const inlined = new Set<Block>();
  for (const b of css) {
    if (!b.name) continue;
    const re = new RegExp(`<link[^>]+href=["'](?:\\./)?${b.name.replace(/\./g, "\\.")}["'][^>]*>`, "i");
    if (re.test(html)) {
      html = html.replace(re, () => `<style>\n${b.code}\n</style>`);
      inlined.add(b);
    }
  }
  for (const b of js) {
    if (!b.name) continue;
    const re = new RegExp(`<script([^>]*)src=["'](?:\\./)?${b.name.replace(/\./g, "\\.")}["']([^>]*)>\\s*</script>`, "i");
    if (re.test(html)) {
      html = html.replace(re, (_, a: string, c: string) => `<script${(a + c).replace(/\s+defer\b/, "")}>\n${b.code.replace(/<\/script/gi, "<\\/script")}\n</script>`);
      inlined.add(b);
    }
  }
  const restCss = css.filter((b) => !inlined.has(b));
  const restJs = js.filter((b) => !inlined.has(b));
  if (restCss.length) html = before(html, "head", restCss.map((b) => `<style>\n${b.code}\n</style>`).join("\n"));
  if (restJs.length) html = before(html, "body", restJs.map((b) => `<script>\n${b.code.replace(/<\/script/gi, "<\\/script")}\n</script>`).join("\n"));
  return html;
}

/** A React component as a page: React, ReactDOM and Babel from a CDN compile and mount it. */
function reactPage(b: Block): string {
  let code = b.code
    .replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");
  const name =
    code.match(/export\s+default\s+function\s+([A-Z]\w*)/)?.[1] ??
    code.match(/export\s+default\s+([A-Z]\w*)\s*;?/)?.[1] ??
    code.match(/(?:function|const)\s+(App|[A-Z]\w*)\b/)?.[1] ??
    "App";
  code = code.replace(/export\s+default\s+function/, "function").replace(/export\s+default\s+[A-Z]\w*\s*;?/, "").replace(/^export\s+/gm, "");
  const source = JSON.stringify(`const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, createContext, Fragment } = React;\n${code}\nReactDOM.createRoot(document.getElementById("root")).render(React.createElement(${name}));`).replace(/<\//g, "<\\/");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<script src="https://cdn.tailwindcss.com/3.4.16"></script>
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
</head>
<body>
<div id="root"></div>
<script>
try {
  var out = Babel.transform(${source}, { presets: [["typescript", { isTSX: true, allExtensions: true }], "react"] }).code;
  new Function(out)();
} catch (e) {
  document.getElementById("root").innerHTML = '<pre style="color:#b91c1c;white-space:pre-wrap;padding:16px;font:13px monospace"></pre>';
  document.querySelector("pre").textContent = String(e);
}
</script>
</body>
</html>`;
}

/** The runnable project in a reply, or null when it has nothing a browser can run. */
export function findProject(md: string): Project | null {
  const blocks = codeBlocks(md).filter((b) => b.code.trim());
  const pages = blocks.filter((b) => isHtml(b) && !TEMPLATE.test(b.code));
  if (pages.length) {
    // The largest HTML block is the page; CSS and browser JavaScript from the same reply join it.
    const page = pages.reduce((a, b) => (b.code.length > a.code.length ? b : a));
    const css = blocks.filter(isCss);
    const js = blocks.filter((b) => isJs(b) && !isServer(b.code));
    const html = stitch(page, css, js);
    return { kind: "html", title: titleOf(html, page.name || "Web page"), html, files: [page, ...css, ...js], complete: [page, ...css, ...js].every((b) => b.closed) };
  }
  const jsx = blocks.filter((b) => isJsx(b) && !isServer(b.code) && /return\s*\(?\s*</.test(b.code));
  if (jsx.length) {
    const main = jsx.find((b) => /export\s+default/.test(b.code)) ?? jsx[0];
    return { kind: "react", title: main.name || "React app", html: reactPage(main), files: [main], complete: main.closed };
  }
  return null;
}

/** A file name from the project title, e.g. "Budget Planner" → "budget-planner.html". */
export const projectFileName = (p: Project) => `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "project"}.html`;

const EXT: Record<string, string> = { python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts", jsx: "jsx", tsx: "tsx", html: "html", css: "css", json: "json", bash: "sh", sh: "sh", shell: "sh", sql: "sql", php: "php", go: "go", rust: "rs", java: "java", yaml: "yml", yml: "yml", toml: "toml", text: "txt", txt: "txt", markdown: "md", md: "md", dockerfile: "Dockerfile" };

function stackOf(files: { name: string; code: string }[]): string {
  const all = files.map((f) => f.code).join("\n");
  if (/from flask|import flask/i.test(all)) return "Python (Flask)";
  if (/django/i.test(all)) return "Python (Django)";
  if (/from fastapi/i.test(all)) return "Python (FastAPI)";
  if (/express\(|from ['"]express/.test(all)) return "Node.js (Express)";
  if (/<\?php/.test(all)) return "PHP";
  if (files.some((f) => f.name.endsWith(".py"))) return "Python";
  if (files.some((f) => f.name === "package.json")) return "Node.js";
  return "a server";
}

/** A multi-file project that can't run in the browser, as named files ready to zip. */
export function findServerProject(md: string): ServerProject | null {
  if (findProject(md)) return null;
  const blocks = codeBlocks(md).filter((b) => b.code.trim());
  const named = blocks.filter((b) => b.name);
  const template = blocks.some((b) => isHtml(b) && TEMPLATE.test(b.code));
  if (named.length < 2 && !template) return null;
  const used = new Set<string>();
  const files = blocks.map((b, i) => {
    let name = b.name || (isHtml(b) && template ? "templates/index.html" : `file${i + 1}.${EXT[b.lang] ?? "txt"}`);
    // Flask looks for page templates in templates/.
    if (template && isHtml(b) && b.name && !b.name.includes("/")) name = `templates/${b.name}`;
    while (used.has(name)) name = name.replace(/(\.\w+)?$/, (e) => `-${i}${e}`);
    used.add(name);
    return { name, code: b.code };
  });
  const stack = stackOf(files);
  return { kind: "server", title: files.find((f) => /app\.py|main\.py|server\.js|index\.js/.test(f.name))?.name.replace(/\.\w+$/, "") || "project", stack, files, complete: blocks.every((b) => b.closed) };
}

/* A small ZIP writer (stored, no compression): enough for a handful of text files. */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function zipFiles(files: { name: string; code: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.code);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}
