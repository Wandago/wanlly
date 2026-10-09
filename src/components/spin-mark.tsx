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
