"use client";

import type { ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "./icon";

/* A full-page "coming soon" for tools that aren't ready yet, with what to expect. */
export function ComingSoon({ icon, title, text, points, action }: { icon: IconName; title: string; text: string; points: string[]; action?: ReactNode }) {
  const { dispatch } = useWorkspace();
  return (
    <main className="relative grid h-full min-h-0 place-items-center overflow-y-auto px-4 py-10">
      <button
        type="button"
        aria-label="Open sidebar"
        onClick={() => dispatch({ type: "setSidebar", open: true })}
        className="absolute top-3 left-3 grid rounded-[10px] p-2 hover:bg-hover md:hidden"
      >
        <Icon name="menu" />
      </button>
      <div className="flex w-full max-w-[520px] flex-col items-center gap-5 text-center">
        <span className="grid size-16 place-items-center rounded-[20px] bg-accent-soft text-accent">
          <Icon name={icon} size={28} />
        </span>
        <span className="rounded-full border border-line px-3 py-1 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Coming soon</span>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{title}</h1>
        <p className="text-[15px] text-muted text-balance">{text}</p>
        <ul className="flex w-full flex-col gap-2 text-left">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[14px]">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {p}
            </li>
          ))}
        </ul>
        {action}
      </div>
    </main>
  );
}
