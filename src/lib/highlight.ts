/*
 * A small syntax highlighter for the Builder's code editor: one regular expression per
 * language picks out comments, strings, keywords and so on, and everything else stays plain.
 * It returns pieces with a class name, rendered as text (never HTML), so code can't run.
 */

export type Piece = { text: string; kind?: "c" | "s" | "k" | "n" | "t" | "a" | "p" | "f" | "h" };

const STR = `"(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'`;
const JS_KEYWORDS =
  "const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|void|yield|static|interface|type|enum|implements|public|private|protected|readonly|as|delete";
const PY_KEYWORDS =
  "def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|with|try|except|finally|raise|pass|break|continue|lambda|yield|None|True|False|global|nonlocal|async|await|self|print";

/** Each language: a pattern of named groups, in order of precedence. */
const RULES: Record<string, RegExp> = {
  js: new RegExp(
    [
      `(?<c>\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)`,
      `(?<s>${STR}|\`(?:\\\\.|[^\`\\\\])*\`)`,
      `(?<k>\\b(?:${JS_KEYWORDS})\\b)`,
      `(?<n>\\b\\d+(?:\\.\\d+)?\\b)`,
      `(?<t><\\/?[A-Z][\\w.]*|<\\/?[a-z][\\w-]*(?=[\\s>/]))`,
      `(?<f>\\b[A-Za-z_$][\\w$]*(?=\\s*\\())`,
    ].join("|"),
    "g",
  ),
  css: new RegExp(
    [`(?<c>\\/\\*[\\s\\S]*?\\*\\/)`, `(?<s>${STR})`, `(?<k>@[\\w-]+|!important)`, `(?<p>[\\w-]+(?=\\s*:(?!:)[^;{}]*[;}]))`, `(?<n>#[0-9a-fA-F]{3,8}\\b|-?\\b\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\\b)`, `(?<t>[.#][\\w-]+)`].join("|"),
    "g",
  ),
  html: new RegExp([`(?<c><!--[\\s\\S]*?-->)`, `(?<t><\\/?[\\w-]+|\\/?>)`, `(?<a>\\s[\\w:@.-]+(?==))`, `(?<s>${STR})`].join("|"), "g"),
  json: new RegExp([`(?<p>"(?:\\\\.|[^"\\\\\\n])*"(?=\\s*:))`, `(?<s>"(?:\\\\.|[^"\\\\\\n])*")`, `(?<k>\\b(?:true|false|null)\\b)`, `(?<n>-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`].join("|"), "g"),
  py: new RegExp(
    [`(?<c>#[^\\n]*)`, `(?<s>"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|[rbfu]?${STR})`, `(?<k>\\b(?:${PY_KEYWORDS})\\b)`, `(?<n>\\b\\d+(?:\\.\\d+)?\\b)`, `(?<f>\\b[A-Za-z_]\\w*(?=\\s*\\())`].join("|"),
    "g",
  ),
  md: new RegExp([`(?<h>^#{1,6}[^\\n]*)`, `(?<s>\`[^\`\\n]+\`)`, `(?<k>\\*\\*[^*\\n]+\\*\\*)`, `(?<a>\\[[^\\]\\n]+\\]\\([^)\\n]+\\))`].join("|"), "gm"),
};

const BY_EXT: Record<string, string> = { js: "js", mjs: "js", cjs: "js", jsx: "js", ts: "js", tsx: "js", css: "css", scss: "css", html: "html", htm: "html", svg: "html", xml: "html", vue: "html", json: "json", webmanifest: "json", py: "py", md: "md" };

/** The language a file is highlighted as, from its name; null for plain text. */
export function languageOf(path: string): string | null {
  return BY_EXT[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

/** Very large files stay plain, so typing never lags. */
const MAX_CHARS = 150_000;

export function highlight(code: string, lang: string | null): Piece[] {
  const re = lang ? RULES[lang] : null;
  if (!re || code.length > MAX_CHARS) return [{ text: code }];
  const out: Piece[] = [];
  let last = 0;
  re.lastIndex = 0;
  for (const m of code.matchAll(re)) {
    if (!m[0]) continue;
    if (m.index! > last) out.push({ text: code.slice(last, m.index) });
    const kind = (Object.entries(m.groups ?? {}).find(([, v]) => v !== undefined)?.[0] ?? undefined) as Piece["kind"];
    out.push({ text: m[0], kind });
    last = m.index! + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last) });
  return out;
}
