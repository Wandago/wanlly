"use client";

import * as Popover from "@radix-ui/react-popover";
import type { CSSProperties, ReactNode } from "react";
import { STYLES } from "@/lib/design-styles";
import { Icon } from "./icon";

/*
 * The Design tool's look picker: a grid of small previews, one per built-in style, plus the
 * person's own design systems. Each preview is drawn in code (no images) so it loads instantly
 * and shows the style's colours, type and layout at a glance.
 */

const serif = 'Georgia, "Times New Roman", serif';
const sans = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
const heavy = '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif';

const box = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });

/** A tiny preview of one style. */
export function StyleThumb({ id }: { id: string }) {
  const frame = (bg: string, children: ReactNode, color = "#111") => (
    <span aria-hidden="true" className="relative block size-full overflow-hidden" style={{ background: bg, color }}>
      {children}
    </span>
  );
  switch (id) {
    case "editorial":
      return frame(
        "#f4f1ea",
        <>
          <span style={box({ left: "8%", top: "10%", font: `600 6px/1 ${sans}`, letterSpacing: ".18em", color: "#8a8478" })}>ISSUE 07</span>
          <span style={box({ left: "8%", top: "22%", right: "8%", font: `italic 400 22px/0.95 ${serif}`, letterSpacing: "-.02em" })}>
            The quiet <span style={{ color: "#a3281f" }}>issue</span>
          </span>
          <span style={box({ left: "8%", right: "8%", top: "66%", height: 1, background: "#1a1a1a" })} />
          <span style={box({ left: "8%", top: "72%", width: "38%", height: 3, background: "#cfc8bb", boxShadow: "0 6px 0 #cfc8bb, 0 12px 0 #cfc8bb" })} />
          <span style={box({ right: "8%", top: "72%", width: "38%", height: "20%", background: "#1e5a3c" })} />
        </>,
        "#1a1a1a",
      );
    case "swiss":
      return frame(
        "#ffffff",
        <>
          {[25, 50, 75].map((x) => (
            <span key={x} style={box({ left: `${x}%`, top: 0, bottom: 0, width: 1, background: "#eee" })} />
          ))}
          <span style={box({ left: "6%", top: "8%", font: `800 26px/0.85 ${sans}`, letterSpacing: "-.05em" })}>
            Grid
            <br />
            01
          </span>
          <span style={box({ right: 0, top: 0, width: "34%", height: "46%", background: "#e30613" })} />
          <span style={box({ left: "6%", bottom: "10%", font: `500 7px/1 ${sans}` })}>→ Form follows function</span>
        </>,
      );
    case "product":
      return frame(
        "#fafafa",
        <>
          <span style={box({ left: 0, top: 0, bottom: 0, width: "24%", background: "#f1f1f3", borderRight: "1px solid #e4e4e7" })} />
          {[16, 28, 40].map((y, i) => (
            <span key={y} style={box({ left: "5%", top: `${y}%`, width: "14%", height: 4, borderRadius: 2, background: i === 0 ? "#2563eb" : "#d4d4d8" })} />
          ))}
          <span style={box({ left: "30%", top: "12%", font: `600 9px/1 ${sans}`, color: "#09090b" })}>Revenue</span>
          <span style={box({ left: "30%", top: "26%", font: `700 15px/1 ${sans}`, color: "#09090b" })}>KES 84,200</span>
          {[0, 1, 2].map((r) => (
            <span key={r} style={box({ left: "30%", right: "6%", top: `${54 + r * 14}%`, height: 10, borderRadius: 3, background: "#fff", border: "1px solid #e4e4e7" })} />
          ))}
          <span style={box({ right: "6%", top: "12%", padding: "2px 5px", borderRadius: 4, background: "#09090b", color: "#fff", font: `600 6px/1 ${sans}` })}>Export</span>
        </>,
      );
    case "dark-premium":
      return frame(
        "#0a0a0b",
        <>
          <span style={box({ left: "50%", top: "8%", translate: "-50% 0", padding: "2px 5px", borderRadius: 9, border: "1px solid #2a2a2e", font: `500 6px/1 ${sans}`, color: "#c6f432" })}>NEW</span>
          <span style={box({ left: 0, right: 0, top: "22%", textAlign: "center", font: `700 14px/1 ${sans}`, letterSpacing: "-.04em" })}>Ship faster.</span>
          <span style={box({ left: "50%", top: "40%", translate: "-50% 0", width: 34, height: 9, borderRadius: 5, background: "#c6f432" })} />
          <span style={box({ left: "8%", top: "58%", width: "52%", height: "32%", borderRadius: 5, background: "#151518", border: "1px solid #232327" })} />
          <span style={box({ right: "8%", top: "58%", width: "28%", height: "14%", borderRadius: 5, background: "#151518", border: "1px solid #232327" })} />
          <span style={box({ right: "8%", top: "76%", width: "28%", height: "14%", borderRadius: 5, background: "#151518", border: "1px solid #232327" })} />
        </>,
        "#ffffff",
      );
    case "playful":
      return frame(
        "#fff7e6",
        <>
          <span style={box({ left: "8%", top: "10%", font: `900 20px/0.9 ${heavy}`, letterSpacing: "-.03em" })}>
            Hey
            <br />
            <span style={{ color: "#ff5a36" }}>you!</span>
          </span>
          <span style={box({ right: "10%", top: "16%", width: "34%", height: "40%", borderRadius: 10, background: "#ffd23f", border: "2px solid #111", boxShadow: "4px 4px 0 #111", rotate: "6deg" })} />
          <span style={box({ left: "8%", bottom: "12%", padding: "4px 8px", borderRadius: 10, background: "#2ec4b6", border: "2px solid #111", boxShadow: "3px 3px 0 #111", font: `800 7px/1 ${sans}` })}>Let&apos;s go</span>
          <span style={box({ right: "14%", bottom: "12%", font: `900 16px/1 ${sans}`, color: "#ff5a36" })}>★</span>
        </>,
      );
    case "motion":
      return frame(
        "#111111",
        <>
          {[30, 42, 54].map((y, i) => (
            <span key={y} style={box({ left: "6%", top: `${y}%`, width: `${30 - i * 8}%`, height: 2, borderRadius: 2, background: "#ff5a1f", opacity: 0.35 + i * 0.2 })} />
          ))}
          <span style={box({ left: "28%", top: "24%", font: `800 24px/0.9 ${sans}`, letterSpacing: "-.05em" })}>
            Move<span style={{ color: "#ff5a1f" }}>.</span>
          </span>
          <span style={box({ left: "28%", top: "62%", width: "50%", height: 3, background: "#333" })} />
          <span style={box({ left: "28%", top: "62%", width: "30%", height: 3, background: "#ff5a1f" })} />
          <span style={box({ left: "8%", bottom: "10%", font: `500 6px/1 ui-monospace, monospace`, color: "#888" })}>SCROLL ↓</span>
        </>,
        "#ffffff",
      );
    case "glass":
      return frame(
        "#151a3a",
        <>
          <span style={box({ left: "-10%", top: "-20%", width: "60%", height: "90%", borderRadius: "50%", background: "#7c5cff", filter: "blur(14px)" })} />
          <span style={box({ right: "-10%", bottom: "-30%", width: "60%", height: "90%", borderRadius: "50%", background: "#00c2ff", filter: "blur(14px)" })} />
          <span style={box({ left: "14%", top: "22%", width: "60%", height: "56%", borderRadius: 10, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.3)", backdropFilter: "blur(6px)" })} />
          <span style={box({ left: "36%", top: "38%", width: "54%", height: "48%", borderRadius: 10, background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.35)" })} />
          <span style={box({ left: "42%", top: "48%", font: `600 9px/1.2 ${sans}`, color: "#fff" })}>Depth</span>
        </>,
        "#ffffff",
      );
    case "3d":
      return frame(
        "#05060a",
        <>
          <svg viewBox="0 0 100 75" className="absolute inset-0 size-full">
            <g fill="none" stroke="#7c5cff" strokeWidth="0.9" transform="translate(50 36)">
              <polygon points="0,-24 21,-8 13,18 -13,18 -21,-8" />
              <path d="M0,-24 L0,-6 L21,-8 M0,-6 L13,18 M0,-6 L-13,18 M0,-6 L-21,-8" />
              <circle r="27" stroke="#2a2550" />
            </g>
            {[
              [12, 14],
              [86, 20],
              [20, 62],
              [80, 60],
              [62, 10],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#9a8cff" />
            ))}
          </svg>
          <span style={box({ left: 0, right: 0, bottom: "8%", textAlign: "center", font: `700 9px/1 ${sans}`, letterSpacing: "-.02em" })}>Into the next dimension</span>
        </>,
        "#ffffff",
      );
    case "afro-modern":
      return frame(
        "#f3e9d8",
        <>
          <svg viewBox="0 0 100 16" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[22%] w-full">
            {Array.from({ length: 10 }, (_, i) => (
              <g key={i} transform={`translate(${i * 10} 0)`}>
                <rect width="10" height="16" fill={["#c4532c", "#1f2a5a", "#d9a441"][i % 3]} />
                <polygon points="0,16 5,4 10,16" fill={["#d9a441", "#c4532c", "#1f2a5a"][i % 3]} />
              </g>
            ))}
          </svg>
          <span style={box({ left: "8%", top: "34%", font: `800 17px/0.95 ${sans}`, letterSpacing: "-.03em", color: "#1f2a5a" })}>
            Made in
            <br />
            <span style={{ color: "#c4532c" }}>Nairobi</span>
          </span>
          <span style={box({ right: "8%", bottom: "12%", width: 18, height: 18, borderRadius: "50%", background: "#1e5a3c" })} />
        </>,
        "#1f2a5a",
      );
    default:
      return frame(
        "var(--surface)",
        <span className="absolute inset-0 grid place-items-center text-faint">
          <Icon name="grid" size={20} />
        </span>,
      );
  }
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
