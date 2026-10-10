"use client";

import { useState } from "react";
import { useWidth } from "../ads/creatives";
import { btnExport, downloadCsv } from "./admin-ui";

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

/**
 * Drag across days to zoom into them (with totals for the stretch while dragging), click a day to
 * pin its values, and export what's shown as CSV.
 */
export function TrendChart({
  days: allDays,
  series: allSeries,
  format = (v) => v.toLocaleString("en-US"),
  label,
  name,
}: {
  days: string[];
  series: Series[];
  format?: (v: number) => string;
  label: string;
  /** File name for the CSV export; the label when not given. */
  name?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  // Zoom and pin belong to one set of days; new data (another range) starts fresh.
  const dataKey = `${allDays[0]}:${allDays.length}`;
  const [zoomState, setZoom] = useState<{ key: string; from: number; to: number } | null>(null);
  const [pinState, setPin] = useState<{ key: string; day: string } | null>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const zoom = zoomState?.key === dataKey ? zoomState : null;
  const from = zoom?.from ?? 0;
  const to = zoom?.to ?? allDays.length - 1;
  const days = allDays.slice(from, to + 1);
  const series = allSeries.map((s) => ({ ...s, values: s.values.slice(from, to + 1) }));
  const pinned = pinState?.key === dataKey ? days.indexOf(pinState.day) : -1;
  const shown = hover ?? (pinned >= 0 ? pinned : null);

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

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * w;
    return Math.min(last, Math.max(0, Math.round(((px - PAD.left) / innerW) * (days.length - 1))));
  };
  const sel = drag && drag.a !== drag.b ? { lo: Math.min(drag.a, drag.b), hi: Math.max(drag.a, drag.b) } : null;
  const total = (s: { values: number[] }, lo: number, hi: number) => s.values.slice(lo, hi + 1).reduce((n, v) => n + v, 0);

  const exportCsv = () =>
    downloadCsv(name ?? label, [["Day", ...series.map((s) => s.label)], ...days.map((d, i) => [d, ...series.map((s) => s.values[i] ?? 0)])]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {!single && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <i className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="hidden text-faint sm:inline">{zoom ? `${dayLabel(days[0])} – ${dayLabel(days[last])}` : "Drag across days to zoom · click to pin"}</span>
          {zoom && (
            <button type="button" className={btnExport} onClick={() => setZoom(null)}>
              Show all
            </button>
          )}
          <button type="button" className={btnExport} onClick={exportCsv} title="Download these days as CSV">
            Export CSV
          </button>
        </span>
      </div>
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg
            width={w}
            height={H}
            role="img"
            aria-label={label}
            className="block cursor-crosshair touch-none select-none"
            onPointerDown={(e) => {
              const i = indexAt(e.clientX, e.currentTarget.getBoundingClientRect());
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ a: i, b: i });
            }}
            onPointerMove={(e) => {
              const i = indexAt(e.clientX, e.currentTarget.getBoundingClientRect());
              setHover(i);
              if (drag) setDrag({ ...drag, b: i });
            }}
            onPointerUp={() => {
              if (drag && drag.a !== drag.b) {
                const lo = Math.min(drag.a, drag.b);
                const hi = Math.max(drag.a, drag.b);
                setZoom({ key: dataKey, from: from + lo, to: from + hi });
                setPin(null);
                setHover(null);
              } else if (drag) {
                const day = days[drag.a];
                setPin(pinState?.key === dataKey && pinState.day === day ? null : { key: dataKey, day });
              }
              setDrag(null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {sel && <rect x={x(sel.lo)} y={PAD.top} width={Math.max(1, x(sel.hi) - x(sel.lo))} height={innerH} fill="var(--accent)" opacity={0.12} />}
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
            {pinned >= 0 && <line x1={x(pinned)} x2={x(pinned)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />}
            {shown !== null && !sel && (
              <g pointerEvents="none">
                <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--faint)" strokeWidth={1} />
                {series.map((s) => (
                  <circle key={s.key} cx={x(shown)} cy={y(s.values[shown] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {sel ? (
          <div className="pointer-events-none absolute top-1 left-1/2 z-10 flex min-w-[160px] -translate-x-1/2 flex-col gap-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs shadow-soft">
            <span className="text-faint">
              {dayLabel(days[sel.lo])} – {dayLabel(days[sel.hi])} · {sel.hi - sel.lo + 1} days
            </span>
            {series.map((s) => {
              const t = total(s, sel.lo, sel.hi);
              return (
                <span key={s.key} className="flex items-center gap-1.5">
                  <i className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <b className="font-mono font-semibold tabular-nums">{format(t)}</b>
                  <span className="text-muted">
                    {s.label} · {format(t / (sel.hi - sel.lo + 1))}/day
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          shown !== null && (
            <div
              className="pointer-events-none absolute top-1 z-10 flex min-w-[120px] flex-col gap-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs shadow-soft"
              style={x(shown) > w / 2 ? { right: w - x(shown) + 10 } : { left: x(shown) + 10 }}
            >
              <span className="text-faint">
                {dayLabel(days[shown])}
                {shown === pinned && hover === null ? " · pinned" : ""}
              </span>
              {series.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <i className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                  <b className="font-mono font-semibold tabular-nums">{format(s.values[shown] ?? 0)}</b>
                  <span className="text-muted">{s.label}</span>
                </span>
              ))}
            </div>
          )
        )}
      </div>
      {zoom && (
        <p className="text-xs text-muted">
          {days.length} days:{" "}
          {series.map((s, i) => (
            <span key={s.key}>
              {i > 0 && " · "}
              <b className="font-mono font-semibold text-fg">{format(total(s, 0, last))}</b> {s.label.toLowerCase()} ({format(total(s, 0, last) / days.length)}/day)
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
