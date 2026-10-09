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

/** Validates the `attachments` field. Returns null when it's malformed or too large. */
export function readAttachments(raw: unknown): { files: Binary[]; text: string; meta: FileMeta[] } | null {
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
      const body = a.text.slice(0, 120_000);
      total += body.length;
      text += `\n\n<file name="${name}">\n${body}\n</file>`;
      meta.push({ name, mime: mime || "text/plain", size: body.length });
    } else return null;
  }
  return total > MAX_ATTACH_CHARS ? null : { files, text, meta };
}
