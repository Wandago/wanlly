"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef } from "react";
import { FLOOR_CREDITS, SPOT_REWARD } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "./icon";
import { UsageMeters } from "./usage-meters";

/** A small ring for today's usage, like a context meter. Fills as the daily limit is used. */
export function Ring({ used, size = 18 }: { used: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, used));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={2.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={pct >= 0.9 ? "var(--bad)" : "var(--accent)"}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}

/**
 * Credits and usage, under the message box. The ring shows how much of today's limit is used;
 * opening it shows the balance, today's and this week's limits, and a way to earn more.
 */
export function CreditsButton({ price, from }: { price: number; from: boolean }) {
  const { credits, synced, usage, floorUnlocked, dispatch } = useWorkspace();
  const ref = useRef<HTMLButtonElement>(null);
  const last = useRef(credits);

  // A small bump when credits go up.
  useEffect(() => {
    const el = ref.current;
    if (el && credits > last.current) {
      el.classList.remove("animate-bump");
      void el.offsetWidth;
      el.classList.add("animate-bump");
    }
    last.current = credits;
  }, [credits]);

  const dayUsed = usage ? usage.dayUsed / usage.dayLimit : 0;
  return (
    <Popover.Root>
      <Popover.Trigger
        ref={ref}
        aria-label={`${credits} credits, ${Math.round(dayUsed * 100)}% of today's limit used. Show usage`}
        className="flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-xs text-muted tabular-nums outline-none hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent-line data-[state=open]:bg-hover data-[state=open]:text-fg"
      >
        <Ring used={dayUsed} />
        {synced ? credits : "–"}
        <span className="max-sm:hidden">{credits === 1 ? "credit" : "credits"}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-40 flex w-[300px] max-w-[calc(100vw-24px)] flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4 text-fg shadow-soft"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted">Credits</span>
              <b className="font-display text-2xl leading-tight font-semibold">{synced ? credits : "–"}</b>
            </div>
            <span className="text-right text-xs text-muted">
              This message
              <b className="block font-mono text-[13px] font-medium text-fg">
                {price}
                {from ? "+" : ""} cr
              </b>
            </span>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-xs font-medium text-muted">Usage limits</span>
            <UsageMeters usage={usage} videos />
          </div>
          <Popover.Close
            onClick={() => dispatch({ type: "setEarnOpen", open: true })}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-accent-line bg-accent-soft p-2 text-[13px] font-semibold text-accent"
          >
            <Icon name="play" size={15} />
            {floorUnlocked ? `Watch a video · +${SPOT_REWARD}` : `First video today · +${FLOOR_CREDITS}`}
          </Popover.Close>
          {from && <p className="text-xs text-faint">Claude replies start at this price; long replies cost a little more.</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
