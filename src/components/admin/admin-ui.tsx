"use client";

import type { ReactNode } from "react";

/* Building blocks shared by every admin tab. */

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(url: string, method = "GET", body?: object): Promise<T> {
  const r = await fetch(url, { method, cache: "no-store", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.error ?? "Something went wrong", r.status);
  return data as T;
}

export const num = (v: number) => v.toLocaleString("en-US");
export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const btnDark = "inline-flex items-center gap-1.5 rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium hover:border-faint disabled:opacity-50";

export function Card({ title, note, actions, children }: { title: string; note?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="text-[13px] text-muted">{note}</p>}
        </div>
        {actions && <div className="ml-auto flex flex-wrap gap-1.5">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-3.5">
      <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{label}</span>
      <span className="font-display text-2xl leading-none font-semibold tabular-nums">{typeof value === "number" ? num(value) : value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-hover p-[3px]" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-2.5 py-1 text-[13px] ${value === v ? "bg-surface font-medium text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-code px-3 py-6 text-center text-[13px] text-muted">{children}</p>;
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-hover text-muted",
  approved: "bg-good/12 text-good",
  declined: "bg-bad/12 text-bad",
  active: "bg-good/12 text-good",
  slowed: "bg-hover text-muted",
  challenged: "bg-hover text-muted",
  frozen: "bg-bad/12 text-bad",
  banned: "bg-bad/12 text-bad",
  deleted: "bg-hover text-faint",
};
export const Chip = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize ${STATUS_CHIP[s] ?? "bg-hover text-muted"}`}>{s}</span>;


export const usd = (v: number) => (v === 0 ? "$0" : v < 0.01 ? "<$0.01" : v < 100 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`);
export const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%` : "–");

/** Compact table; numeric columns right-aligned, an optional bar column showing magnitude. */
export function Table({ head, rows, numeric = [] }: { head: string[]; rows: ReactNode[][]; numeric?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-muted">
            {head.map((h, i) => (
              <th key={i} className={`border-b border-line px-2 py-2 font-medium whitespace-nowrap ${numeric.includes(i) ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-hover/60">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-line px-2 py-1.5 ${numeric.includes(j) ? "text-right font-mono tabular-nums whitespace-nowrap" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single-series magnitude bar for a table cell. */
export function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-2 w-20 overflow-hidden" aria-hidden="true">
      <span className="block h-full rounded-r-[4px] bg-series-1" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </span>
  );
}
