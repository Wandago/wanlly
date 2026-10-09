"use client";

import { useState } from "react";
import { useWidth } from "../ads/creatives";

/*
 * Line chart for a daily series, one y-axis. 2px lines, a 10% wash under a single series,
 * hairline grid, end dots with a surface ring, a crosshair with one tooltip for every series,
 * and a legend whenever there is more than one series. Values also appear in the tables beside it.
 */

export type Series = { key: string; label: string; color: string; values: number[] };

const H = 180;
const PAD = { top: 12, right: 52, bottom: 24, left: 44 };

/** Clean tick step: 1, 2 or 5 times a power of ten. */
function niceMax(max: number) {
  if (max <= 0) return { top: 1, step: 0.25 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { top: Math.ceil(max / step) * step, step };
}

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function TrendChart({ days, series, format = (v) => v.toLocaleString("en-US"), label }: { days: string[]; series: Series[]; format?: (v: number) => string; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 280);
  const innerW = w - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const { top, step } = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const x = (i: number) => PAD.left + (days.length < 2 ? innerW / 2 : (i / (days.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const xLabels = days.length > 2 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : days.map((_, i) => i);
  const last = days.length - 1;
  const single = series.length === 1;

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * w;
    const i = Math.round(((px - PAD.left) / innerW) * (days.length - 1));
    setHover(Math.min(last, Math.max(0, i)));
  };

  return (
    <div className="flex flex-col gap-2">
      {!single && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <i className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg
            width={w}
            height={H}
            role="img"
            aria-label={label}
            className="block touch-none"
            onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint font-mono text-[10px]">
                  {format(t)}
                </text>
              </g>
            ))}
            {xLabels.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-faint text-[10px]">
                {dayLabel(days[i])}
              </text>
            ))}
            {series.map((s) => {
              const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
              return (
                <g key={s.key}>
                  {single && <polygon points={`${x(0)},${y(0)} ${pts} ${x(last)},${y(0)}`} fill={s.color} opacity={0.1} />}
                  <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={x(last)} cy={y(s.values[last] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                </g>
              );
            })}
            {/* End labels only where they won't collide: the single series, or two that sit apart. */}
            {(single || Math.abs(y(series[0].values[last] ?? 0) - y(series[1]?.values[last] ?? 0)) > 14) &&
              series.map((s) => (
                <text key={s.key} x={x(last) + 8} y={y(s.values[last] ?? 0)} dy="0.32em" className="fill-fg font-mono text-[11px] font-medium">
                  {format(s.values[last] ?? 0)}
                </text>
              ))}
            {hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--faint)" strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 flex min-w-[120px] flex-col gap-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs shadow-soft"
            style={x(hover) > w / 2 ? { right: w - x(hover) + 10 } : { left: x(hover) + 10 }}
          >
            <span className="text-faint">{dayLabel(days[hover])}</span>
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <i className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <b className="font-mono font-semibold tabular-nums">{format(s.values[hover] ?? 0)}</b>
                <span className="text-muted">{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
