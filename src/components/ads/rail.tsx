"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { NetworkSize } from "@/lib/ad-network";
import { FLOOR_CREDITS, RAIL_SPONSORS, SPOT_REWARD, type Sponsor } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { Cover } from "./cover";
import { DisplayCreative } from "./creatives";
import { Tracked } from "./tracked";
import { NetworkSlot, useNetworkTest } from "./network-slot";
import { creativeOf, openSponsor, useNetwork, useSponsors, useTick } from "@/lib/ads-context";
import { NetworkUnit } from "./network-unit";

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

function Cta({ sponsor, placement, className = "" }: { sponsor: Sponsor; placement: string; className?: string }) {
  const { dispatch } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => openSponsor(sponsor, placement) || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}
      className={`rounded-[9px] border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:border-faint ${className}`}
    >
      {sponsor.cta}
    </button>
  );
}

/** Native sponsor card with a cover image. The main side-panel unit. */
export function CoverCard({ sponsor, placement = "rail_cover" }: { sponsor: Sponsor; placement?: string }) {
  return (
    <Tracked key={creativeOf(sponsor)} placement={placement} format="native" creative={creativeOf(sponsor)}>
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
          <Cta sponsor={sponsor} placement={placement} className="mt-1 self-start" />
        </div>
      </article>
    </Tracked>
  );
}

/** A network banner (300×250) placed in the same rounded frame, so it never looks pasted in. */
function DisplayFrame({ sponsor }: { sponsor: Sponsor }) {
  const { dispatch } = useWorkspace();
  if (useNetworkTest())
    return (
      <div className="rounded-2xl border border-line bg-surface p-2 py-3 shadow-soft">
        <NetworkSlot w={300} h={250} label="Side panel" />
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-soft">
      <div className="px-1">
        <SponsoredLabel sponsor={sponsor} />
      </div>
      <Tracked key={creativeOf(sponsor)} placement="rail_banner" format="display" creative={creativeOf(sponsor)} className="grid animate-rise place-items-center overflow-hidden rounded-xl bg-code">
        <button
          type="button"
          aria-label={`${sponsor.name}: ${sponsor.cta}`}
          onClick={() => openSponsor(sponsor, "rail_banner") || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}
          className="block overflow-hidden rounded-xl"
        >
          <DisplayCreative size="300x250" sponsor={sponsor} />
        </button>
      </Tracked>
    </div>
  );
}

/** A network banner in the same rounded frame as Wanlly's own ads. */
function NetworkFrame({ size, network, placement }: { size: NetworkSize; network: string; placement: string }) {
  return (
    <div className="flex animate-rise flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-soft">
      <span className="self-start px-1 text-[11px] tracking-[0.07em] text-faint uppercase">Advertisement</span>
      <NetworkUnit size={size} network={network} placement={placement} />
    </div>
  );
}

const TALL = "(min-height: 1200px)";
/** Screens tall enough for a 300×600 half-page banner under the cover card. */
function useTall() {
  return useSyncExternalStore(
    (fn) => {
      const m = window.matchMedia(TALL);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => window.matchMedia(TALL).matches,
    () => false,
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
  const top = useRotation(useSponsors("rail_cover", RAIL_SPONSORS), 45000);
  const banner = useRotation(useSponsors("rail_banner", RAIL_SPONSORS), 60000, 2);
  // With an ad network on, the two slots take turns: one shows a network banner while the other
  // shows a sponsor card, and they swap every 45 seconds. Tall screens get the 300×600 size.
  const network = useNetwork();
  const turn = useTick(45000);
  const tall = useTall();
  const has = (s: NetworkSize) => !!network?.sizes.includes(s);
  const bannerSize: NetworkSize | null = tall && has("300x600") ? "300x600" : has("300x250") ? "300x250" : null;
  return (
    <aside aria-label="Sponsored" className="hidden min-h-0 border-l border-line bg-side xl:block">
      <div className="sticky top-0 flex h-full flex-col gap-3 overflow-y-auto p-3 [scrollbar-width:none]">
        {network && has("300x250") && turn % 2 === 1 ? <NetworkFrame size="300x250" network={network.name} placement="rail_cover" /> : <CoverCard sponsor={top} />}
        <div className="hidden [@media(min-height:860px)]:block">
          {network && bannerSize && turn % 2 === 0 ? <NetworkFrame size={bannerSize} network={network.name} placement="rail_banner" /> : <DisplayFrame sponsor={banner} />}
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
  const sponsor = useRotation(useSponsors("sidebar_card", RAIL_SPONSORS), 50000, 1);
  return (
    <Tracked key={creativeOf(sponsor)} placement="sidebar_card" format="native" creative={creativeOf(sponsor)} className="hidden [@media(min-height:700px)]:block">
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
