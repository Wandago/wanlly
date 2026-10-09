"use client";

import type { Attachment } from "@/lib/attach";
import { Icon } from "./icon";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Attached files as small chips: a thumbnail for images, the name and size for the rest. */
export function AttachmentTray({ items, onRemove, small = false }: { items: Pick<Attachment, "id" | "name" | "mime" | "size" | "preview">[]; onRemove?: (id: string) => void; small?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Attachments">
      {items.map((a) => (
        <li key={a.id} className={`group relative flex items-center gap-2 rounded-xl border border-line bg-surface ${small ? "p-1 pr-2" : "p-1.5 pr-2.5"}`}>
          {a.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.preview} alt="" className={`${small ? "size-8" : "size-10"} rounded-lg object-cover`} />
          ) : (
            <span className={`grid ${small ? "size-8" : "size-10"} place-items-center rounded-lg bg-hover font-mono text-[10px] font-semibold text-muted uppercase`}>
              {a.mime === "application/pdf" ? "PDF" : (a.name.split(".").pop() ?? "file").slice(0, 4)}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="max-w-[160px] truncate text-xs font-medium">{a.name}</span>
            {a.size > 0 && <span className="text-[11px] text-faint">{kb(a.size)}</span>}
          </span>
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${a.name}`}
              onClick={() => onRemove(a.id)}
              className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm hover:text-fg"
            >
              <Icon name="x" size={11} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The overlay shown while files are dragged over a drop area. */
export function DropOverlay({ label = "Drop files to attach" }: { label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[inherit] border-2 border-dashed border-accent bg-accent-soft/90 text-[13px] font-semibold text-accent">
      <span className="flex items-center gap-2">
        <Icon name="clip" size={16} /> {label}
      </span>
    </div>
  );
}
