import "server-only";

/*
 * Files people attach to a message: dropped, pasted or picked. The browser shrinks images and
 * reads text files before sending. Images and PDFs go to the model as they are; text files are
 * added to the message. Nothing here is stored except each file's name, type and size.
 */

export const MAX_FILES = 4;
/** Total size of attachments in one request, as base64 characters (about 4 MB of files). */
export const MAX_ATTACH_CHARS = 5_600_000;
/** Request body limit for routes that accept attachments. */
export const MAX_BODY = MAX_ATTACH_CHARS + 64_000;

export const BINARY_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export type Binary = { name: string; mime: string; data: string };
export type FileMeta = { name: string; mime: string; size: number };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rarr: "→", larr: "←", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

/**
 * A web page as the words a person would read: title, description, headings, text, prices and
 * link labels, without scripts, styles or markup. A saved shop page is often 90% code; this keeps
 * the part the model needs (and a fraction of the tokens).
 */
const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
  );

export function readableHtml(html: string): string {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const desc = decode(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "");
  // Data the page draws itself from (JSON in a script tag): often the most useful part of a saved
  // report or shop page, so it's kept, minified.
  const data = [...html.matchAll(/<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try {
        return JSON.stringify(JSON.parse(m[1]));
      } catch {
        return m[1].trim();
      }
    })
    .filter(Boolean);
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi, " [image: $1] ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|ul|ol|table|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => `\n${"#".repeat(Number(n))} `)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m) => decode(m))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
  const json = data.length ? `\n\nData embedded in the page (JSON):\n${data.join("\n").slice(0, 80_000)}` : "";
  return [title && `Page title: ${title}`, desc && `Description: ${desc}`, body].filter(Boolean).join("\n").slice(0, 30_000) + json;
}

/**
 * Validates the `attachments` field. Returns null when it's malformed or too large.
 * `readable` turns large HTML files into their readable text (for chat, where people share a page
 * to talk about it; Code keeps the markup, since that's what gets edited).
 */
export function readAttachments(raw: unknown, opts: { readable?: boolean } = {}): { files: Binary[]; text: string; meta: FileMeta[] } | null {
  if (raw === undefined || raw === null) return { files: [], text: "", meta: [] };
  if (!Array.isArray(raw) || raw.length > MAX_FILES) return null;
  const files: Binary[] = [];
  const meta: FileMeta[] = [];
  let text = "";
  let total = 0;
  for (const a of raw as Record<string, unknown>[]) {
    if (!a || typeof a !== "object") return null;
    const name = typeof a.name === "string" ? a.name.slice(0, 120).replace(/[<>"]/g, "") : "file";
    const mime = typeof a.mime === "string" ? a.mime.slice(0, 80) : "";
    if (typeof a.data === "string") {
      if (!BINARY_TYPES.has(mime)) return null;
      total += a.data.length;
      files.push({ name, mime, data: a.data });
      meta.push({ name, mime, size: Math.round((a.data.length * 3) / 4) });
    } else if (typeof a.text === "string") {
      const html = /html/i.test(mime) || /\.html?$/i.test(name);
      const body = opts.readable && html && a.text.length > 8_000 ? `(The readable text of this web page; scripts and markup removed.)\n${readableHtml(a.text)}` : a.text.slice(0, 120_000);
      total += body.length;
      text += `\n\n<file name="${name}">\n${body}\n</file>`;
      meta.push({ name, mime: mime || "text/plain", size: body.length });
    } else return null;
  }
  return total > MAX_ATTACH_CHARS ? null : { files, text, meta };
}
