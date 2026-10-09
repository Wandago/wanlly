"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";

/*
 * Attachments, ready to send: images are shrunk in the browser (longest side 1600 px, WebP so
 * logos keep transparency), PDFs go as they are, and text or code files are read as text.
 */

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Base64 for images and PDFs. */
  data?: string;
  /** Contents of a text or code file. */
  text?: string;
  /** Object URL for an image thumbnail, while the page is open. */
  preview?: string;
};

export const MAX_FILES = 4;
const MAX_TOTAL = 4 * 1024 * 1024;
const MAX_PDF = 3 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|html?|css|scss|js|jsx|ts|tsx|py|java|kt|c|h|cpp|cs|go|rs|rb|php|swift|sql|sh|toml|ini|env|log)$/i;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Shrinks an image so it's quick to send; small images are kept as they are. */
async function shrink(file: File): Promise<{ blob: Blob; mime: string }> {
  if (file.type === "image/gif" || file.size < 350_000) return { blob: file, mime: file.type };
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  return blob ? { blob, mime: "image/webp" } : { blob: file, mime: file.type };
}

async function prepare(file: File): Promise<Attachment> {
  const id = crypto.randomUUID();
  const name = file.name || (file.type.startsWith("image/") ? "pasted-image.png" : "file");
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    const { blob, mime } = await shrink(file);
    return { id, name, mime, size: blob.size, data: await toBase64(blob), preview: URL.createObjectURL(blob) };
  }
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF) throw new Error(`${name} is over 3 MB. Attach a smaller PDF.`);
    return { id, name, mime: file.type, size: file.size, data: await toBase64(file) };
  }
  if (file.type.startsWith("text/") || TEXT_EXT.test(name) || file.type === "application/json") {
    if (file.size > 400_000) throw new Error(`${name} is too long to attach.`);
    return { id, name, mime: file.type || "text/plain", size: file.size, text: await file.text() };
  }
  throw new Error(`${name} can't be attached. Use images, PDFs, or text and code files.`);
}

/** What the server receives for each attachment. */
export const forSending = (list: Attachment[]) => list.map(({ name, mime, data, text }) => (data ? { name, mime, data } : { name, mime, text }));

/**
 * Attachments for one message box: add by picking, dropping or pasting, remove, and clear after
 * sending. Spread `dropProps` on the area that accepts drops and pass `onPaste` to the text box.
 */
export function useAttachments(onError: (message: string) => void) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const depth = useRef(0);
  const live = useRef(items);
  useEffect(() => {
    live.current = items;
  });
  // Free image previews when the box goes away.
  useEffect(() => () => live.current.forEach((a) => a.preview && URL.revokeObjectURL(a.preview)), []);

  const add = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const room = MAX_FILES - live.current.length;
      if (room <= 0) return onError(`You can attach up to ${MAX_FILES} files.`);
      setBusy(true);
      const ready: Attachment[] = [];
      for (const f of files.slice(0, room)) {
        try {
          ready.push(await prepare(f));
        } catch (e) {
          onError((e as Error).message);
        }
      }
      if (files.length > room) onError(`Only ${MAX_FILES} files fit in one message.`);
      const total = [...live.current, ...ready].reduce((n, a) => n + a.size, 0);
      if (total > MAX_TOTAL) {
        ready.forEach((a) => a.preview && URL.revokeObjectURL(a.preview));
        onError("Those files are too big together. Keep attachments under 4 MB.");
      } else setItems((xs) => [...xs, ...ready]);
      setBusy(false);
    },
    [onError],
  );

  const remove = (id: string) =>
    setItems((xs) => {
      const gone = xs.find((a) => a.id === id);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return xs.filter((a) => a.id !== id);
    });

  /** Empties the tray after sending. Previews stay alive for the sent message. */
  const clear = () => setItems([]);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      add(Array.from(e.dataTransfer.files));
    },
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (!files.length) return; // Plain text pastes as usual.
    e.preventDefault();
    add(files);
  };

  return { items, add, remove, clear, dragging, busy, dropProps, onPaste };
}
