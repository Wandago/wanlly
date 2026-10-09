"use client";

import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { STYLES } from "@/lib/design-styles";
import { Icon } from "./icon";

/*
 * The Design tool's look picker: a grid of small previews, one per built-in style, plus the
 * person's own design systems. Each preview is a real example page in that style.
 */

/**
 * A style's preview: a real example page designed for that style (scripts/style-samples),
 * screenshotted to public/styles. "Any style" gets a plain tile.
 */
export function StyleThumb({ id }: { id: string }) {
  if (!STYLES.some((s) => s.id === id))
    return (
      <span aria-hidden="true" className="grid size-full place-items-center bg-surface text-faint">
        <Icon name="grid" size={20} />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element -- small static previews; the image optimiser isn't available on Workers
  return <img src={`/styles/${id}.webp`} alt="" loading="lazy" decoding="async" className="block size-full object-cover object-top" />;
}

/**
 * `value` is "style:<id>", "ds:<id>" or "" (any style). Design systems are the person's own
 * Design System files.
 */
export function StylePicker({ value, onChange, systems }: { value: string; onChange: (v: string) => void; systems: { id: number; name: string }[] }) {
  const style = value.startsWith("style:") ? STYLES.find((s) => `style:${s.id}` === value) : undefined;
  const system = value.startsWith("ds:") ? systems.find((s) => `ds:${s.id}` === value) : undefined;
  const label = style?.name ?? system?.name ?? "Any style";
  const tile = (v: string, name: string, blurb: string, thumb: ReactNode) => {
    const on = v === value || (v === "" && !style && !system);
    return (
      <Popover.Close asChild key={v || "any"}>
        <button
          type="button"
          aria-pressed={on}
          onClick={() => onChange(v)}
          className={`group flex flex-col gap-1.5 rounded-xl p-1.5 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-hover" : ""}`}
        >
          <span className={`block aspect-[4/3] overflow-hidden rounded-lg border ${on ? "border-accent ring-2 ring-accent/40" : "border-line"}`}>{thumb}</span>
          <span className="px-0.5">
            <b className="block truncate text-[12.5px] font-semibold">{name}</b>
            <small className="block truncate text-[11px] text-muted">{blurb}</small>
          </span>
        </button>
      </Popover.Close>
    );
  };
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Style: ${label}`}
        className="flex max-w-[170px] items-center gap-1.5 rounded-lg border border-line bg-surface py-1 pr-2 pl-1 text-xs text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:text-fg"
      >
        <span className="block h-[18px] w-6 shrink-0 overflow-hidden rounded border border-line">
          <StyleThumb id={style?.id ?? ""} />
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
            {STYLES.map((s) => tile(`style:${s.id}`, s.name, s.blurb, <StyleThumb id={s.id} />))}
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
  );
}
