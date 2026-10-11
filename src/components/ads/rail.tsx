"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { NetworkSize } from "@/lib/ad-network";
import { RAIL_SPONSORS, type Sponsor } from "@/lib/catalog";
import { useReward, useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { Cover } from "./cover";
import { DisplayCreative } from "./creatives";
import { Tracked } from "./tracked";
import { NetworkSlot, useNetworkTest } from "./network-slot";
import { creativeOf, openSponsor, useNetwork, useSponsors } from "@/lib/ads-context";
import { NetworkOrFallback, NetworkUnit } from "./network-unit";
import { DisplaySlot } from "./display-slot";
import { useLocalSetting } from "@/lib/use-local-setting";

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
function NetworkFrame({ size, network, placement, fallback }: { size: NetworkSize; network: string; placement: string; fallback: ReactNode }) {
  return (
    <NetworkOrFallback fallback={fallback}>
      {(onFilled) => (
        <div className="flex w-full animate-rise flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-2 shadow-soft">
          <span className="self-start px-1 text-[11px] tracking-[0.07em] text-faint uppercase">Advertisement</span>
          <NetworkUnit size={size} network={network} placement={placement} onFilled={onFilled} />
        </div>
      )}
    </NetworkOrFallback>
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
  const { perAd: SPOT_REWARD, floor: FLOOR_CREDITS } = useReward();
  const { floorUnlocked, dispatch } = useWorkspace();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-accent">
        <Icon name="play" size={16} />
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <b className="block font-semibold">{floorUnlocked ? "Keep building" : "First ad today"}</b>
        <span className="text-muted">{floorUnlocked ? `+${SPOT_REWARD} credits an ad` : `+${FLOOR_CREDITS} credits bonus`}</span>
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
/**
 * The side panel can be slimmed to a narrow column (one tall banner) so it takes less room; the
 * choice is remembered in this browser. AppShell reads the same setting for the column width.
 */
export const RAIL_SETTING = "wanlly-rail";

export function AdRail({ wideOnly = false }: { wideOnly?: boolean }) {
  const [mode, setMode] = useLocalSetting(RAIL_SETTING, "full");
  if (mode === "slim") return <SlimRail wideOnly={wideOnly} onExpand={() => setMode("full")} />;
  return <FullRail wideOnly={wideOnly} onSlim={() => setMode("slim")} />;
}

/** One tall banner (160×600, or a sponsor card) and a small earn button, in a narrow column. */
function SlimRail({ wideOnly, onExpand }: { wideOnly: boolean; onExpand: () => void }) {
  const sponsor = useRotation(useSponsors("rail_banner", RAIL_SPONSORS), 60000, 2);
  const { perAd } = useReward();
  const { dispatch } = useWorkspace();
  return (
    <aside aria-label="Sponsored" className={`hidden min-h-0 border-l border-line bg-side ${wideOnly ? "2xl:col-start-3 2xl:row-start-1 2xl:block" : "xl:col-start-3 xl:row-start-1 xl:block"}`}>
      <div className="sticky top-0 flex h-full flex-col items-center gap-3 overflow-y-auto px-2 py-3 [scrollbar-width:none]">
        <button type="button" onClick={onExpand} title="Show the full side panel" aria-label="Show the full side panel" className="self-end rounded-md px-1.5 py-0.5 text-xs text-faint hover:bg-hover hover:text-fg">
          «
        </button>
        <DisplaySlot
          placement="rail_banner"
          sizes={["160x600"]}
          label="Ad"
          fallback={
            <Tracked key={creativeOf(sponsor)} placement="rail_banner" format="native" creative={creativeOf(sponsor)} className="w-full">
              <button type="button" onClick={() => openSponsor(sponsor, "rail_banner") || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })} className="flex w-full flex-col gap-2 overflow-hidden rounded-xl border border-line bg-surface text-left">
                <div className="h-[90px] overflow-hidden">
                  <Cover sponsor={sponsor} className="h-full" />
                </div>
                <div className="flex flex-col gap-1 px-2.5 pb-2.5">
                  <b className="truncate text-xs font-semibold">{sponsor.name}</b>
                  <span className="line-clamp-3 text-[11px] leading-snug text-muted">{sponsor.headline}</span>
                  <span className="mt-1 text-[11px] font-semibold text-fg">{sponsor.cta} →</span>
                </div>
              </button>
            </Tracked>
          }
        />
        <button type="button" onClick={() => dispatch({ type: "setEarnOpen", open: true })} className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent-line bg-accent-soft px-2 py-2 text-xs font-semibold text-accent">
          <Icon name="play" size={12} /> +{perAd} credits
        </button>
      </div>
    </aside>
  );
}

function FullRail({ wideOnly, onSlim }: { wideOnly: boolean; onSlim: () => void }) {
  const top = useRotation(useSponsors("rail_cover", RAIL_SPONSORS), 45000);
  const banner = useRotation(useSponsors("rail_banner", RAIL_SPONSORS), 60000, 2);
  const extra = useRotation(useSponsors("rail_extra", RAIL_SPONSORS), 55000, 4);
  // Who gets each slot: a sold campaign booked for it always shows; otherwise the ad network;
  // Wanlly's own house sponsors only fill what's left (or a network size that came back empty).
  const network = useNetwork();
  const tall = useTall();
  const has = (s: NetworkSize) => !!network?.sizes.includes(s);
  const bannerSize: NetworkSize | null = tall && has("300x600") ? "300x600" : has("300x250") ? "300x250" : null;
  return (
    <aside aria-label="Sponsored" className={`hidden min-h-0 border-l border-line bg-side ${wideOnly ? "2xl:col-start-3 2xl:row-start-1 2xl:block" : "xl:col-start-3 xl:row-start-1 xl:block"}`}>
      <div className="sticky top-0 flex h-full flex-col gap-3 overflow-y-auto p-3 [scrollbar-width:none]">
        <button type="button" onClick={onSlim} title="Make the side panel narrower" aria-label="Make the side panel narrower" className="-mb-1.5 self-end rounded-md px-1.5 py-0.5 text-xs text-faint hover:bg-hover hover:text-fg">
          »
        </button>
        {network && has("300x250") && !top.campaignId ? <NetworkFrame size="300x250" network={network.name} placement="rail_cover" fallback={<CoverCard sponsor={top} />} /> : <CoverCard sponsor={top} />}
        {/* Laptop screens fit two units over the earn button; tall ones a third. */}
        <div className="hidden [@media(min-height:740px)]:block">
          {network && bannerSize && !banner.campaignId ? <NetworkFrame size={bannerSize} network={network.name} placement="rail_banner" fallback={<DisplayFrame sponsor={banner} />} /> : <DisplayFrame sponsor={banner} />}
        </div>
        <div className="hidden [@media(min-height:1060px)]:block">
          {network && has("300x250") && !extra.campaignId && bannerSize !== "300x600" ? <NetworkFrame size="300x250" network={network.name} placement="rail_extra" fallback={<CoverCard sponsor={extra} placement="rail_extra" />} /> : <CoverCard sponsor={extra} placement="rail_extra" />}
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
