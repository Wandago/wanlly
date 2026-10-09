"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState, type ReactNode } from "react";
import { STYLES, lookImage, looksForKind } from "@/lib/design-styles";
import { Icon } from "./icon";

/*
 * The Design tool's look picker: a grid of small previews, one per built-in style, plus the
 * person's own design systems. Each preview is a real example page in that style.
 */

/**
 * A style's preview: a real example page designed for that style (scripts/style-samples),
 * screenshotted to public/styles. "Any style" gets a plain tile.
 */
export function StyleThumb({ id, dir = "" }: { id: string; dir?: string }) {
  if (!STYLES.some((s) => s.id === id))
    return (
      <span aria-hidden="true" className="grid size-full place-items-center bg-surface text-faint">
        <Icon name="grid" size={20} />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element -- small static previews; the image optimiser isn't available on Workers
  return <img src={lookImage(id, dir)} alt="" loading="lazy" decoding="async" className="block size-full object-cover object-top" />;
}

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
  </svg>
);

const ALL_WEB = STYLES.map((s) => ({ id: s.id, dir: "" }));

/**
 * A large look at one style's example page, with its art direction in a sentence. Arrows (and
 * the ← → keys) move through `items` (a tab's looks; every website look by default); "Use this
 * style" hands the choice back.
 */
export function StylePreview({
  id,
  items = ALL_WEB,
  onIdChange,
  onUse,
}: {
  id: string | null;
  items?: readonly { id: string; dir: string }[];
  onIdChange: (id: string | null) => void;
  onUse: (id: string) => void;
}) {
  const i = items.findIndex((s) => s.id === id);
  const style = i >= 0 ? STYLES.find((s) => s.id === items[i].id) : undefined;
  const dir = i >= 0 ? items[i].dir : "";
  const step = (d: number) => onIdChange(items[(i + d + items.length) % items.length].id);
  useEffect(() => {
    if (!style) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onIdChange(items[(i - 1 + items.length) % items.length].id);
      if (e.key === "ArrowRight") onIdChange(items[(i + 1) % items.length].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [style, i, items, onIdChange]);
  const line = style?.guide.split("\n")[0].replace(/^Art direction:\s*/, "") ?? "";
  const direction = line.charAt(0).toUpperCase() + line.slice(1);
  const nav = "grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted hover:text-fg";
  return (
    <Dialog.Root open={!!style} onOpenChange={(o) => !o && onIdChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_9_12/0.6)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[1000px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[20px] border border-line bg-surface p-4 text-fg shadow-soft sm:p-5">
          {style && (
            <>
              <header className="flex items-start gap-3">
                <div className="min-w-0">
                  <Dialog.Title className="font-display text-xl font-semibold tracking-[-0.02em]">{style.name}</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-[13px] text-muted">{direction}</Dialog.Description>
                </div>
                <span className="ml-auto shrink-0 pt-1 text-xs text-faint tabular-nums">
                  {i + 1} / {items.length}
                </span>
                <Dialog.Close aria-label="Close" className="grid size-[34px] shrink-0 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
                  <Icon name="x" />
                </Dialog.Close>
              </header>
              <div className="relative overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- static preview */}
                <img key={`${dir}/${style.id}`} src={lookImage(style.id, dir)} alt={`Example in the ${style.name} style`} className="block aspect-[4/3] w-full bg-hover object-cover object-top" />
              </div>
              <footer className="flex flex-wrap items-center gap-2">
                <button type="button" aria-label="Previous style" onClick={() => step(-1)} className={nav}>
                  <Chevron dir="left" />
                </button>
                <button type="button" aria-label="Next style" onClick={() => step(1)} className={nav}>
                  <Chevron dir="right" />
                </button>
                <p className="hidden min-w-0 flex-1 text-[12px] text-faint sm:block">An example made for Wanlly. Your design keeps this look and uses your own content.</p>
                <button type="button" onClick={() => onUse(style.id)} className="ml-auto rounded-lg bg-fg px-4 py-2.5 text-sm font-semibold text-bg hover:opacity-90">
                  Use this style
                </button>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * `value` is "style:<id>", "ds:<id>" or "" (any style). Design systems are the person's own
 * Design System files.
 */
export function StylePicker({ value, onChange, systems, kind = "design" }: { value: string; onChange: (v: string) => void; systems: { id: number; name: string }[]; kind?: string }) {
  // Examples made for this kind of design come first (slides show decks, and so on).
  const looks = looksForKind(kind);
  const style = value.startsWith("style:") ? STYLES.find((s) => `style:${s.id}` === value) : undefined;
  const system = value.startsWith("ds:") ? systems.find((s) => `ds:${s.id}` === value) : undefined;
  const label = style?.name ?? system?.name ?? "Any style";
  const [preview, setPreview] = useState<string | null>(null);
  const tile = (v: string, name: string, blurb: string, thumb: ReactNode) => {
    const on = v === value || (v === "" && !style && !system);
    return (
      <div key={v || "any"} className="group/tile relative">
        <Popover.Close asChild>
          <button
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={`group flex w-full flex-col gap-1.5 rounded-xl p-1.5 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-hover" : ""}`}
          >
            <span className={`block aspect-[4/3] overflow-hidden rounded-lg border ${on ? "border-accent ring-2 ring-accent/40" : "border-line"}`}>{thumb}</span>
            <span className="px-0.5">
              <b className="block truncate text-[12.5px] font-semibold">{name}</b>
              <small className="block truncate text-[11px] text-muted">{blurb}</small>
            </span>
          </button>
        </Popover.Close>
        {v.startsWith("style:") && (
          <button
            type="button"
            aria-label={`See ${name} larger`}
            title="See it larger"
            onClick={() => setPreview(v.slice(6))}
            className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-[rgb(8_9_12/0.6)] text-white opacity-0 transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
            </svg>
          </button>
        )}
      </div>
    );
  };
  return (
    <>
      <StylePreview
        id={preview}
        items={looks}
        onIdChange={setPreview}
        onUse={(id) => {
          setPreview(null);
          onChange(`style:${id}`);
        }}
      />
      <Popover.Root>
        <Popover.Trigger
          aria-label={`Style: ${label}`}
          className="flex max-w-[170px] items-center gap-1.5 rounded-lg border border-line bg-surface py-1 pr-2 pl-1 text-xs text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:text-fg"
        >
          <span className="block h-[18px] w-6 shrink-0 overflow-hidden rounded border border-line">
            <StyleThumb id={style?.id ?? ""} dir={looks.find((l) => l.id === style?.id)?.dir} />
          </span>
          <span className="truncate">{label}</span>
          <Icon name="down" size={13} className="shrink-0 text-faint" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="z-40 max-h-[min(560px,calc(100vh-120px))] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-line bg-surface p-3 text-fg shadow-soft"
          >
            <p className="px-1.5 pb-2 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Pick a look</p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {tile("", "Any style", "The designer decides", <StyleThumb id="" />)}
              {looks.map((l) => {
                const s = STYLES.find((x) => x.id === l.id)!;
                return tile(`style:${s.id}`, s.name, s.blurb, <StyleThumb id={s.id} dir={l.dir} />);
              })}
            </div>
            {systems.length > 0 && (
              <>
                <p className="px-1.5 pt-3 pb-2 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Your design systems</p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {systems.map((x) => {
                    const on = value === `ds:${x.id}`;
                    return (
                      <Popover.Close asChild key={x.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => onChange(`ds:${x.id}`)}
                          className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:text-fg"}`}
                        >
                          {x.name}
                        </button>
                      </Popover.Close>
                    );
                  })}
                </div>
              </>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
