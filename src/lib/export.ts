"use client";

/* Exports for the Design editor: PowerPoint built in the browser, and saving to Google Drive. */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type Color = { hex: string; alpha: number } | null;
export type MeasuredSlide = {
  bg: string;
  shapes: { x: number; y: number; w: number; h: number; fill: Color; line: Color; lw: number; radius: number; round?: boolean }[];
  texts: { x: number; y: number; w: number; h: number; text: string; size: number; bold: boolean; italic: boolean; color: string; font: string; align: "left" | "center" | "right" }[];
};

type Pptx = {
  layout: string;
  title: string;
  addSlide: () => {
    background: { color: string };
    addShape: (shape: string, o: object) => void;
    addText: (text: string, o: object) => void;
  };
  ShapeType: Record<string, string>;
  write: (o: { outputType: "blob" }) => Promise<Blob>;
};

let lib: Promise<new () => Pptx> | null = null;

/** PptxGenJS from jsDelivr, pinned and checked against its hash, loaded only when someone exports. */
function loadPptx() {
  lib ??= new Promise((resolve, reject) => {
    const w = window as unknown as { PptxGenJS?: new () => Pptx };
    if (w.PptxGenJS) return resolve(w.PptxGenJS);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
    s.integrity = "sha384-Cck14aA9cifjYolcnjebXRfWGkz5ltHMBiG4px/j8GS+xQcb7OhNQWZYyWjQ+UwQ";
    s.crossOrigin = "anonymous";
    s.onload = () => (w.PptxGenJS ? resolve(w.PptxGenJS) : reject(new Error("PowerPoint library didn't load")));
    s.onerror = () => {
      lib = null;
      reject(new Error("Couldn't load the PowerPoint library. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return lib;
}

const IN = (px: number) => px / 96; // 1280×720 px slides are 13.33×7.5 in (16:9)
const PT = (px: number) => Math.max(6, Math.round(px * 0.75 * 10) / 10);

/** Builds an editable .pptx: every slide's boxes become shapes and its text becomes text boxes. */
export async function buildPptx(slides: MeasuredSlide[], title: string): Promise<Blob> {
  const PptxGenJS = await loadPptx();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;
  for (const s of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: s.bg };
    for (const sh of s.shapes) {
      slide.addShape(sh.round ? pptx.ShapeType.ellipse : sh.radius > 4 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        x: IN(sh.x),
        y: IN(sh.y),
        w: IN(sh.w),
        h: IN(sh.h),
        fill: sh.fill ? { color: sh.fill.hex, transparency: Math.round((1 - sh.fill.alpha) * 100) } : { type: "none" },
        line: sh.line ? { color: sh.line.hex, width: Math.max(0.25, sh.lw * 0.75), transparency: Math.round((1 - sh.line.alpha) * 100) } : { type: "none" },
        rectRadius: !sh.round && sh.radius > 4 ? Math.min(0.5, sh.radius / Math.min(sh.w, sh.h)) : undefined,
      });
    }
    for (const t of s.texts) {
      slide.addText(t.text, {
        x: IN(t.x),
        y: IN(t.y),
        w: IN(Math.max(t.w, 8)),
        h: IN(Math.max(t.h, t.size * 1.2)),
        fontSize: PT(t.size),
        fontFace: t.font || "Arial",
        bold: t.bold,
        italic: t.italic,
        color: t.color,
        align: t.align,
        valign: "top",
        margin: 0,
        fit: "shrink",
      });
    }
  }
  return pptx.write({ outputType: "blob" });
}

/** Uploads a file to the person's Google Drive, converting to a Google format when asked. */
export async function driveUpload(token: string, file: Blob, name: string, convertTo?: string): Promise<string> {
  const meta = { name, ...(convertTo ? { mimeType: convertTo } : {}) };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", file);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error?.message ?? `Google Drive said ${r.status}`);
  return b.webViewLink ?? `https://drive.google.com/file/d/${b.id}/view`;
}

export function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const fileName = (name: string) => name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "design";
