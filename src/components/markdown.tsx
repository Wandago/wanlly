"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./icon";

/*
 * A small Markdown renderer for model replies: headings, paragraphs, lists, quotes, fenced code
 * with a copy button, and inline code, bold, italic and links. It builds React elements, never
 * HTML strings, so nothing in a reply can run as code on the page. Unclosed fences (a reply that
 * is still streaming) render as code up to the end.
 */

type Block =
  | { kind: "code"; lang: string; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "rule" }
  | { kind: "para"; text: string };

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w+#.-]*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      blocks.push({ kind: "code", lang: fence[2], text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ kind: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ kind: "quote", text: body.join("\n") });
      continue;
    }
    const li = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
    if (li) {
      const ordered = !!li[2];
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/);
        if (m && !!m[2] === ordered) items.push(m[3]);
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) items[items.length - 1] += `\n${lines[i].trim()}`;
        else break;
        i++;
      }
      blocks.push({ kind: "list", ordered, start: ordered ? Number(li[2]) : 1, items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|~~~|#{1,6}\s|>|([-*+]|\d+[.)])\s)/.test(lines[i])) body.push(lines[i++]);
    blocks.push({ kind: "para", text: body.join("\n") });
  }
  return blocks;
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** Inline code, links, bold and italic, in that order of precedence. */
function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = key;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined)
      out.push(
        <code key={k++} className="rounded-md bg-code px-1.5 py-0.5 font-mono text-[0.88em]">
          {m[1]}
        </code>,
      );
    else if (m[2] !== undefined)
      out.push(
        SAFE_URL.test(m[3]) ? (
          <a key={k++} href={m[3]} target="_blank" rel="noopener noreferrer nofollow" className="text-fg underline decoration-faint underline-offset-[3px] hover:decoration-fg">
            {inline(m[2], k * 100)}
          </a>
        ) : (
          m[2]
        ),
      );
    else if (m[4] !== undefined || m[5] !== undefined)
      out.push(
        <strong key={k++} className="font-semibold">
          {inline(m[4] ?? m[5], k * 100)}
        </strong>,
      );
    else out.push(<em key={k++}>{inline(m[6] ?? m[7], k * 100)}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  // Single line breaks inside a paragraph become <br>.
  return out.flatMap((part, i): ReactNode[] =>
    typeof part === "string" ? part.split("\n").flatMap((s, j): ReactNode[] => (j ? [<br key={`b${key}-${i}-${j}`} />, s] : [s])) : [part],
  );
}

/** Which file a code block becomes in the Builder, for code a browser can run. */
const APP_FILE: Record<string, string> = { html: "index.html", jsx: "App.jsx", tsx: "App.tsx" };

/** Turns a code block into a Builder project, where it can be previewed, changed, published or saved to GitHub. */
function OpenInBuilder({ lang, text }: { lang: string; text: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const file = APP_FILE[lang.toLowerCase()];
  if (!file) return null;
  const open = async () => {
    setBusy(true);
    try {
      const title = text.match(/<title>([^<]{1,60})<\/title>/i)?.[1] ?? text.match(/export\s+default\s+function\s+(\w{1,60})/)?.[1] ?? "New app";
      const made = await fetch("/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: title }) });
      const b = await made.json().catch(() => ({}));
      if (!made.ok || !b.id) throw new Error(b.error);
      await fetch(`/api/build/${b.id}/files`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: file, content: text }) });
      router.push(`/build/${b.id}`);
    } catch {
      setBusy(false);
    }
  };
  return (
    <button type="button" disabled={busy} onClick={open} title="Opens this code as an app you can preview, change, publish or save to GitHub" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-hover hover:text-fg disabled:opacity-50">
      <Icon name="bolt" size={12} />
      {busy ? "Opening…" : "Open in Builder"}
    </button>
  );
}

function CodeBlock({ lang, text, openable }: { lang: string; text: string; openable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-code">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 font-mono text-[11px] text-faint">
        {lang || "text"}
        <span className="ml-auto" />
        {openable && <OpenInBuilder lang={lang} text={text} />}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-hover hover:text-fg"
        >
          <Icon name={copied ? "check" : "copy"} size={12} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[1.6]">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/** `openable`: code blocks a browser can run get an "Open in Builder" button (chat replies). */
export function Markdown({ text, openable }: { text: string; openable?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 leading-[1.65] [overflow-wrap:anywhere]">
      {parse(text).map((b, i) => {
        switch (b.kind) {
          case "code":
            return <CodeBlock key={i} lang={b.lang} text={b.text} openable={openable} />;
          case "heading": {
            const cls = b.level <= 2 ? "mt-1 text-[17px] font-semibold tracking-[-0.01em]" : "mt-1 text-[15px] font-semibold";
            return b.level <= 2 ? (
              <h3 key={i} className={cls}>
                {inline(b.text)}
              </h3>
            ) : (
              <h4 key={i} className={cls}>
                {inline(b.text)}
              </h4>
            );
          }
          case "list": {
            // "[ ] task" and "[x] task" items (a plan's checklist) get a box instead of a bullet.
            const items = b.items.map((it, j) => {
              const box = it.match(/^\[([ xX])\]\s+([\s\S]*)$/);
              if (!box) return <li key={j}>{inline(it)}</li>;
              const done = box[1] !== " ";
              return (
                <li key={j} className="-ml-5 flex list-none items-start gap-2">
                  <span aria-label={done ? "Done" : "To do"} className={`mt-[3px] grid size-4 shrink-0 place-items-center rounded border ${done ? "border-accent bg-accent text-white" : "border-faint"}`}>
                    {done && <Icon name="check" size={11} />}
                  </span>
                  <span className={done ? "text-muted line-through decoration-faint" : ""}>{inline(box[2])}</span>
                </li>
              );
            });
            return b.ordered ? (
              <ol key={i} start={b.start} className="flex list-decimal flex-col gap-1 pl-5">
                {items}
              </ol>
            ) : (
              <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
                {items}
              </ul>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-line pl-3 text-muted">
                {inline(b.text)}
              </blockquote>
            );
          case "rule":
            return <hr key={i} className="border-line" />;
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}
