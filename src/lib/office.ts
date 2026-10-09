"use client";

/*
 * Text from Word, PowerPoint and Excel files, read in the browser. Those files are zip archives
 * of XML; this unzips them with the browser's own DecompressionStream and keeps the words:
 * paragraphs and tables from .docx, each slide's text from .pptx, and each sheet as rows of
 * cells from .xlsx. Pictures and formatting are left out.
 */

type Entry = { name: string; method: number; size: number; offset: number };

function entries(buf: ArrayBuffer): Entry[] {
  const v = new DataView(buf);
  // The end-of-central-directory record is in the last 64 KB.
  let end = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("not a zip");
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const dec = new TextDecoder();
  const out: Entry[] = [];
  for (let n = 0; n < count && v.getUint32(p, true) === 0x02014b50; n++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extra = v.getUint16(p + 30, true);
    const comment = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    out.push({ name: dec.decode(new Uint8Array(buf, p + 46, nameLen)), method, size, offset });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

async function read(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf);
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const raw = new Uint8Array(buf, start, e.size);
  if (e.method === 0) return new TextDecoder().decode(raw);
  if (e.method !== 8) throw new Error("unsupported compression");
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

/** Text runs inside one XML fragment, e.g. all <w:t> in a Word paragraph. */
const runs = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, "g"))].map((m) => decode(m[1])).join("");

function docx(xml: string): string {
  const body = xml.replace(/<w:tab\/>/g, "<w:t>\t</w:t>").replace(/<w:br\/>/g, "<w:t>\n</w:t>");
  const out: string[] = [];
  // Tables become rows of cells separated by " | ", paragraphs become lines.
  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const part = m[0];
    if (part.startsWith("<w:tbl>")) {
      for (const row of part.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)) out.push([...row[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => runs(c[0], "w:t").trim()).join(" | "));
      out.push("");
    } else {
      const heading = /<w:pStyle w:val="(Heading\d|Title)"/.exec(part);
      const text = runs(part, "w:t");
      out.push(heading && text ? `${heading[1] === "Title" ? "#" : "#".repeat(Math.min(6, Number(heading[1].slice(7)) + 1))} ${text}` : text);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function columnIndex(ref: string) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

async function xlsx(buf: ArrayBuffer, list: Entry[]): Promise<string> {
  const find = (name: string) => list.find((e) => e.name === name);
  const shared = find("xl/sharedStrings.xml");
  const strings = shared ? [...(await read(buf, shared)).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1], "t")) : [];
  const book = find("xl/workbook.xml");
  const names = book ? [...(await read(buf, book)).matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => decode(m[1])) : [];
  const sheets = list.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, s] of sheets.entries()) {
    out.push(`## Sheet: ${names[i] ?? `Sheet ${i + 1}`}`);
    const xml = await read(buf, s);
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1];
        const type = /t="(\w+)"/.exec(c[1])?.[1];
        const inner = c[2] ?? "";
        const raw = /<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "";
        const value = type === "s" ? (strings[Number(raw)] ?? "") : type === "inlineStr" ? runs(inner, "t") : decode(raw);
        cells[ref ? columnIndex(ref) : cells.length] = value;
      }
      if (cells.some(Boolean)) out.push(Array.from(cells, (x) => (x ?? "").replace(/\t|\n/g, " ")).join("\t"));
    }
    out.push("");
  }
  return out.join("\n").trim();
}

async function pptx(buf: ArrayBuffer, list: Entry[]): Promise<string> {
  const slides = list.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, s] of slides.entries()) {
    const xml = await read(buf, s);
    const paras = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => runs(m[1], "a:t")).filter((t) => t.trim());
    const notes = list.find((e) => e.name === `ppt/notesSlides/notesSlide${i + 1}.xml`);
    const said = notes ? [...(await read(buf, notes)).matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => runs(m[1], "a:t")).filter((t) => t.trim() && !/^\d+$/.test(t.trim())) : [];
    out.push(`## Slide ${i + 1}`, ...paras, ...(said.length ? [`Speaker notes: ${said.join(" ")}`] : []), "");
  }
  return out.join("\n").trim();
}

export const OFFICE = /\.(docx|pptx|xlsx)$/i;
export const OLD_OFFICE = /\.(doc|ppt|xls)$/i;

/** The words in a .docx, .pptx or .xlsx file, as plain text. */
export async function officeText(file: File): Promise<string> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open Office files. Update it, or save the file as PDF.");
  const buf = await file.arrayBuffer();
  const list = entries(buf);
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "docx") {
    const doc = list.find((e) => e.name === "word/document.xml");
    if (!doc) throw new Error("no document");
    return docx(await read(buf, doc));
  }
  if (ext === "pptx") return pptx(buf, list);
  return xlsx(buf, list);
}
