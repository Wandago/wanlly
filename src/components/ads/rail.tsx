"use client";

import { useEffect, useState } from "react";
import { FLOOR_CREDITS, RAIL_SPONSORS, SPOT_REWARD, type Sponsor } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { Cover } from "./cover";
import { DisplayCreative } from "./creatives";
import { Tracked } from "./tracked";

const eyebrow = "text-[11px] uppercase tracking-[0.07em] text-faint";

/** Rotates through sponsors, the way a slot refreshes every 30–60 seconds while it's on screen. */
function useRotation(list: Sponsor[], ms: number, offset = 0) {
  const [i, setI] = useState(offset);
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") setI((n) => n + 1);
    }, ms);
    return () => window.clearInterval(iv);
  }, [ms]);
  return list[i % list.length];
}

function SponsoredLabel({ sponsor }: { sponsor: Sponsor }) {
  const { dispatch } = useWorkspace();
  return (
    <button
      type="button"
      data-ad-ignore
      onClick={() => dispatch({ type: "toast", text: `Paid for by ${sponsor.name}. Shown because of the page you're on, not your prompts.` })}
      className={`${eyebrow} inline-flex items-center gap-1 hover:text-muted`}
    >
      Sponsored
      <span className="grid size-3.5 place-items-center rounded-full border border-current text-[8px] font-semibold">i</span>
    </button>
  );
}

function Cta({ sponsor, className = "" }: { sponsor: Sponsor; className?: string }) {
  const { dispatch } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}
      className={`rounded-[9px] border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-faint ${className}`}
    >
      {sponsor.cta}
    </button>
  );
}

/** Native sponsor card with a cover image. The main side-panel unit. */
export function CoverCard({ sponsor, placement = "rail_cover" }: { sponsor: Sponsor; placement?: string }) {
  return (
    <Tracked key={sponsor.name} placement={placement} format="native" creative={sponsor.name}>
      <article className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <Cover sponsor={sponsor} />
        <div className="flex flex-col gap-1.5 p-3.5">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: sponsor.color }} aria-hidden="true">
              {sponsor.initial}
            </span>
            <b className="text-[13px] font-semibold">{sponsor.name}</b>
            <span className="ml-auto">
              <SponsoredLabel sponsor={sponsor} />
            </span>
          </div>
          <h3 className="font-display text-[15px] leading-tight font-semibold tracking-[-0.01em]">{sponsor.headline}</h3>
          <p className="text-[13px] leading-snug text-muted">{sponsor.text}</p>
          <Cta sponsor={sponsor} className="mt-1 self-start" />
        </div>
      </article>
    </Tracked>
  );
}

/** A network banner (300×250) placed in the same rounded frame, so it never looks pasted in. */
function DisplayFrame({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
      <div className="px-1">
        <SponsoredLabel sponsor={sponsor} />
      </div>
      <Tracked key={sponsor.name} placement="rail_banner" format="display" creative={sponsor.name} className="grid animate-rise place-items-center overflow-hidden rounded-xl bg-code">
        <button type="button" aria-label={`${sponsor.name}: ${sponsor.cta}`} className="block overflow-hidden rounded-xl">
          <DisplayCreative size="300x250" sponsor={sponsor} />
        </button>
      </Tracked>
    </div>
  );
}

/** The earning shortcut that ends every side panel. */
function EarnMini() {
  const { floorUnlocked, dispatch } = useWorkspace();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-accent">
        <Icon name="play" size={16} />
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <b className="block font-semibold">{floorUnlocked ? "Keep building" : "First video today"}</b>
        <span className="text-muted">{floorUnlocked ? `+${SPOT_REWARD} credits a video` : `+${FLOOR_CREDITS} credits bonus`}</span>
      </div>
      <button
        type="button"
        onClick={() => dispatch({ type: "setEarnOpen", open: true })}
        className="rounded-[9px] bg-fg px-3 py-1.5 text-[13px] font-semibold text-bg"
      >
        Watch
      </button>
    </div>
  );
}

/** Right side panel, on every page from 1280px wide. Always running, refreshed while visible. */
export function AdRail() {
  const top = useRotation(RAIL_SPONSORS, 45000);
  const banner = useRotation(RAIL_SPONSORS, 60000, 2);
  return (
    <aside aria-label="Sponsored" className="hidden min-h-0 border-l border-line bg-side xl:block">
      <div className="sticky top-0 flex h-full flex-col gap-3 overflow-y-auto p-3 [scrollbar-width:none]">
        <CoverCard sponsor={top} />
        <div className="hidden [@media(min-height:860px)]:block">
          <DisplayFrame sponsor={banner} />
        </div>
        <div className="mt-auto">
          <EarnMini />
        </div>
      </div>
    </aside>
  );
}

/** Compact sponsor card that lives in the left sidebar on every page. */
export function SidebarAd() {
  const sponsor = useRotation(RAIL_SPONSORS, 50000, 1);
  return (
    <Tracked key={sponsor.name} placement="sidebar_card" format="native" creative={sponsor.name} className="hidden [@media(min-height:700px)]:block">
      <article className="animate-rise overflow-hidden rounded-[14px] border border-line bg-surface">
        <div className="h-[72px] overflow-hidden">
          <Cover sponsor={sponsor} className="h-full" />
        </div>
        <div className="flex flex-col gap-1 px-3 pt-2 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <b className="truncate text-[13px] font-semibold">{sponsor.name}</b>
            <SponsoredLabel sponsor={sponsor} />
          </div>
          <p className="line-clamp-2 text-xs leading-snug text-muted">{sponsor.headline}</p>
        </div>
      </article>
    </Tracked>
  );
}
