"use client";

import { useId } from "react";
import { spinGeometry } from "@/lib/spin-mark";

const G = spinGeometry(24);
const BARE = spinGeometry(29);

/**
 * The Wanlly mark (see lib/spin-mark.ts). `tile` draws the app icon (orange spin on an ink
 * square); without it, just the spin in `className`'s text colour (orange by default).
 */
export function SpinMark({ size = 26, tile = false, className = "text-accent" }: { size?: number; tile?: boolean; className?: string }) {
  const id = `spin${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const g = tile ? G : BARE;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={tile ? undefined : className}>
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="-32" y="-32" width="128" height="128">
          <rect x="-32" y="-32" width="128" height="128" fill="#fff" />
          {g.cuts.map((c, i) => (
            <line key={i} {...c} stroke="#000" strokeWidth={g.slit} strokeLinecap="round" />
          ))}
          <circle cx="32" cy="32" r={g.hole} fill="#000" />
        </mask>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill="#0b0b0d" />}
      <path d={g.star} mask={`url(#${id})`} fill={tile ? "#ff5a1f" : "currentColor"} stroke={tile ? "#ff5a1f" : "currentColor"} strokeWidth={g.soft} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Loading, in Wanlly's mark: the spark drawn as an outline (the slits show as gaps in the line),
 * with a bright stroke tracing around it while the whole mark turns. With reduced motion it
 * breathes instead. `label` is read by screen readers and shown under large loaders.
 */
export function SpinLoader({ size = 40, label = "Loading", showLabel = false, className = "text-accent" }: { size?: number; label?: string; showLabel?: boolean; className?: string }) {
  const id = `load${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Thin lines at large sizes, thicker when small so the shape still reads.
  const w = size >= 36 ? 2.4 : size >= 22 ? 3.4 : 5.5;
  // Small loaders (in buttons and status lines) just turn: a tracing stroke is too fine to see.
  const small = size < 22;
  const ring = +(BARE.hole * 2).toFixed(3);
  const shape = (
    <>
      <path d={BARE.star} pathLength={100} />
      <circle cx="32" cy="32" r={ring} pathLength={100} />
    </>
  );
  return (
    // An empty label marks a decorative loader inside something that already announces itself.
    <span {...(label ? { role: "status", "aria-live": "polite" as const } : { "aria-hidden": true })} className={`inline-flex shrink-0 flex-col items-center gap-3 ${className}`}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="wl-loader overflow-visible">
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x="-32" y="-32" width="128" height="128">
            <rect x="-32" y="-32" width="128" height="128" fill="#fff" />
            {BARE.cuts.map((c, i) => (
              <line key={i} {...c} stroke="#000" strokeWidth={BARE.slit + w} strokeLinecap="round" />
            ))}
          </mask>
        </defs>
        <g mask={`url(#${id})`} fill="none" stroke="currentColor" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
          {small ? shape : <g opacity="0.22">{shape}</g>}
          {!small && <g className="wl-trace">{shape}</g>}
        </g>
      </svg>
      {showLabel ? <span className="text-[13px] text-muted">{label}</span> : label && <span className="sr-only">{label}</span>}
    </span>
  );
}
