"use client";

/*
 * Turning a design into things a codebase can use: a React component (JSX) and design tokens
 * (CSS variables, a Tailwind v4 theme, or JSON). Everything runs in the browser on the saved page.
 */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RENAME: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  viewbox: "viewBox",
  "xlink:href": "xlinkHref",
  "xml:space": "xmlSpace",
};
const BOOLEAN = new Set(["disabled", "checked", "selected", "required", "hidden", "multiple", "readonly", "autofocus", "open"]);

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const jsxText = (s: string) => s.replace(/[{}<>]/g, (c) => `{"${c}"}`);
const jsxString = (s: string) => JSON.stringify(s);

function styleObject(css: string) {
  const parts = css
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(":");
      if (i < 0) return null;
      const prop = d.slice(0, i).trim();
      const key = prop.startsWith("--") ? JSON.stringify(prop) : camel(prop.replace(/^-ms-/, "ms-"));
      return `${key}: ${JSON.stringify(d.slice(i + 1).trim())}`;
    })
    .filter(Boolean);
  return `{{ ${parts.join(", ")} }}`;
}

function attrName(el: Element, name: string) {
  const lower = name.toLowerCase();
  if (RENAME[lower]) return RENAME[lower];
  if (lower.startsWith("data-") || lower.startsWith("aria-")) return lower;
  if (lower.startsWith("on")) return null; // inline handlers don't belong in a component
  // SVG attributes like stroke-width become strokeWidth.
  return el.namespaceURI === "http://www.w3.org/2000/svg" || lower.includes("-") ? camel(lower) : lower;
}

function toJsx(node: Node, depth: number): string {
  const pad = "  ".repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? "").replace(/\s+/g, " ");
    return t.trim() ? pad + jsxText(t.trim()) : "";
  }
  if (node.nodeType === Node.COMMENT_NODE) return `${pad}{/* ${(node.textContent ?? "").trim().replace(/\*\//g, "* /")} */}`;
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toLowerCase() === el.tagName ? el.tagName : el.tagName.toLowerCase();
  if (tag === "script") return "";
  if (tag === "style") return `${pad}<style>{${JSON.stringify(el.textContent ?? "")}}</style>`;
  const attrs = Array.from(el.attributes)
    .map((a) => {
      const name = attrName(el, a.name);
      if (!name) return "";
      if (name === "style") return `style=${styleObject(a.value)}`;
      if (BOOLEAN.has(a.name.toLowerCase()) && (a.value === "" || a.value === a.name)) return name;
      return `${name}=${jsxString(a.value)}`;
    })
    .filter(Boolean);
  const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  if (VOID.has(tag)) return `${pad}${open} />`;
  const kids = Array.from(el.childNodes)
    .map((c) => toJsx(c, depth + 1))
    .filter(Boolean);
  if (!kids.length) return `${pad}${open} />`;
  return `${pad}${open}>\n${kids.join("\n")}\n${pad}</${tag}>`;
}

/** A React component made from the page: its own styles plus the body, ready to paste in. */
export function htmlToJsx(html: string, name: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const component = (name.replace(/[^A-Za-z0-9 ]/g, " ").replace(/(?:^|\s)(\w)/g, (_, c: string) => c.toUpperCase()).replace(/\s/g, "") || "Design").replace(/^(\d)/, "D$1");
  const styles = Array.from(doc.head.querySelectorAll("style")).map((s) => toJsx(s, 3));
  const body = Array.from(doc.body.childNodes)
    .map((c) => toJsx(c, 3))
    .filter(Boolean);
  const usesTailwind = !!doc.querySelector('script[src*="tailwindcss"]');
  return `// ${component}.jsx, made with Wanlly.${usesTailwind ? "\n// Uses Tailwind CSS classes: your project needs Tailwind set up." : ""}
// Fonts from the design: add them to your app's <head> if you use them.
export default function ${component}() {
  return (
    <>
${[...styles, ...body].join("\n")}
    </>
  );
}
`;
}

export type Token = { name: string; value: string };

/** CSS custom properties defined on :root (or html) in the page's styles. */
export function extractTokens(html: string): Token[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
  const out = new Map<string, string>();
  for (const block of css.matchAll(/(?:^|[}\s,])(?::root|html)\s*\{([^}]*)\}/g))
    for (const d of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);?/g)) out.set(d[1], d[2].trim());
  return [...out].map(([name, value]) => ({ name, value }));
}

const isColor = (v: string) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color-mix\()/i.test(v);
const isLength = (v: string) => /^-?[\d.]+(px|rem|em|%)$/.test(v);

export const tokensToCss = (t: Token[]) => `:root {\n${t.map((x) => `  --${x.name}: ${x.value};`).join("\n")}\n}\n`;

/** Tailwind v4 theme: colours, fonts and radii get the namespaces Tailwind expects. */
export function tokensToTailwind(t: Token[]) {
  const line = (x: Token) => {
    const n = x.name.replace(/^(color|colour|font|radius|spacing|text|shadow)-/, "");
    if (isColor(x.value)) return `  --color-${n}: ${x.value};`;
    if (/font|family/.test(x.name)) return `  --font-${n}: ${x.value};`;
    if (/radius|rounded/.test(x.name)) return `  --radius-${n}: ${x.value};`;
    if (/shadow/.test(x.name)) return `  --shadow-${n}: ${x.value};`;
    return `  --${x.name}: ${x.value};`;
  };
  return `/* Paste into your main CSS file after @import "tailwindcss"; */\n@theme {\n${t.map(line).join("\n")}\n}\n`;
}

/** Design tokens in the W3C draft format: { name: { $value, $type } }. */
export function tokensToJson(t: Token[]) {
  const obj = Object.fromEntries(
    t.map((x) => [x.name, { $value: x.value, $type: isColor(x.value) ? "color" : isLength(x.value) ? "dimension" : /font|family/.test(x.name) ? "fontFamily" : "other" }]),
  );
  return JSON.stringify(obj, null, 2) + "\n";
}
