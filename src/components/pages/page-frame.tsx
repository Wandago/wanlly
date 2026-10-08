"use client";

import type { ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";

/** Shared frame for the non-chat pages: a title row and a scrolling body. */
export function PageFrame({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { dispatch } = useWorkspace();
  return (
    <main className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => dispatch({ type: "setSidebar", open: true })}
            className="grid rounded-[10px] p-2 hover:bg-hover md:hidden"
          >
            <Icon name="menu" />
          </button>
          <div className="flex min-w-0 flex-col">
            <h1 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </main>
  );
}

export function Panel({ title, note, children, className = "" }: { title?: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {title && (
        <header className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {note && <p className="text-[13px] text-muted">{note}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export const btnDark = "inline-flex items-center gap-2 rounded-[10px] bg-fg px-3.5 py-2 text-sm font-semibold text-bg";
export const btnGhost = "inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-faint";
export const chip = "rounded-full bg-hover px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted";
