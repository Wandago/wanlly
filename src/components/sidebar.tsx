"use client";

import { DAILY_ALLOWANCE, type ToolId } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "./icon";

const RECENTS: { tool: ToolId; title: string }[] = [
  { tool: "chat", title: "Pricing a free AI app" },
  { tool: "code", title: "Add credit ledger to API" },
  { tool: "images", title: "Mug product shots" },
  { tool: "design", title: "Habit app onboarding" },
  { tool: "chat", title: "Explain prompt caching" },
];

export function Sidebar() {
  const { credits, sidebarOpen, dispatch } = useWorkspace();

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => dispatch({ type: "setSidebar", open: false })} aria-hidden="true" />
      )}
      <aside
        className={`flex min-h-0 flex-col gap-1.5 border-r border-line bg-side px-3 py-3.5 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(300px,86vw)] max-md:pt-[calc(14px+env(safe-area-inset-top,0px))] max-md:transition-transform max-md:duration-200 ${sidebarOpen ? "max-md:translate-x-0 max-md:shadow-soft" : "max-md:-translate-x-[102%]"}`}
        aria-label="Sidebar"
      >
        <div className="flex items-center gap-2.5 px-2 pt-1 pb-3">
          {/* The app icon (public/brand/wanlly-app-icon.svg), drawn inline so it follows the theme. */}
          <svg viewBox="0 0 64 64" className="size-[26px]" aria-hidden="true">
            <defs>
              <mask id="sidebar-node" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                <rect width="64" height="64" fill="#fff" />
                <circle cx="32" cy="26" r="8.8" fill="#000" />
              </mask>
            </defs>
            <rect width="64" height="64" rx="16" className="fill-fg" />
            <path
              d="M11 21 L21 44 L32 26 L43 44 L53 21"
              mask="url(#sidebar-node)"
              fill="none"
              strokeWidth={6.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-bg"
            />
            <circle cx="32" cy="26" r="6.2" className="fill-accent" />
          </svg>
          <b className="font-display text-xl font-semibold tracking-[-0.02em]">Wanlly</b>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "newChat" })}
          className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2 font-medium hover:border-faint"
        >
          <Icon name="plus" />
          New chat
          <kbd className="ml-auto font-mono text-[11px] text-faint">⌘K</kbd>
        </button>

        <div className="px-2.5 pt-3.5 pb-1 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Recent</div>
        <nav className="flex min-h-0 flex-1 flex-col gap-px overflow-auto" aria-label="Recent">
          {RECENTS.map((r) => (
            <button
              key={r.title}
              type="button"
              onClick={() => dispatch(r.tool === "chat" ? { type: "openSampleChat" } : { type: "setTool", tool: r.tool })}
              className="flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-sm text-muted hover:bg-hover hover:text-fg"
            >
              <Icon name={r.tool} size={15} className="text-faint" />
              <span className="truncate">{r.title}</span>
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted">Today&apos;s credits</span>
            <b className="font-mono text-[13px] font-medium tabular-nums">
              {credits} / {DAILY_ALLOWANCE}
            </b>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-hover">
            <i
              className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ width: `${Math.min(100, (credits / DAILY_ALLOWANCE) * 100)}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "setEarnOpen", open: true })}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-accent-line bg-accent-soft p-2 text-sm font-semibold text-accent"
          >
            <Icon name="bolt" size={15} />
            Earn more credits
          </button>
        </div>
        <div className="flex items-center gap-2.5 px-1.5 pt-2 pb-0.5">
          <span className="grid size-[30px] place-items-center rounded-full bg-fg text-[13px] font-semibold text-bg">L</span>
          <div className="flex flex-col text-sm leading-tight">
            Louis
            <small className="text-xs text-faint">Free plan</small>
          </div>
        </div>
      </aside>
    </>
  );
}
