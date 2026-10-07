"use client";

import { useEffect, useRef, useState } from "react";
import { SPOT_REWARD, SPOT_SECONDS, type Sponsor } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "./icon";

function Logo({ sponsor, small = false }: { sponsor: Sponsor; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center font-bold text-white ${small ? "size-5 rounded-md text-[10px]" : "size-[34px] rounded-[10px] text-sm"}`}
      style={{ background: sponsor.color }}
      aria-hidden="true"
    >
      {sponsor.initial}
    </span>
  );
}

const eyebrow = "text-[11px] uppercase tracking-[0.07em] text-faint";

/** Placeholder for the sponsor's link until real ad sources are wired up. */
function SponsorLink({ sponsor, className }: { sponsor: Sponsor; className: string }) {
  const { dispatch } = useWorkspace();
  return (
    <button type="button" className={className} onClick={() => dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}>
      {sponsor.cta}
    </button>
  );
}

/** A rewarded spot that plays wherever it's mounted: a working card, the composer, or the earn sheet. */
export function RewardedSpot({ onDone }: { onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const start = Date.now();
    const iv = window.setInterval(() => {
      const t = (Date.now() - start) / 1000;
      setElapsed(Math.min(t, SPOT_SECONDS));
      if (t >= SPOT_SECONDS) {
        window.clearInterval(iv);
        done.current();
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, []);

  return (
    <div>
      <div className="relative flex aspect-[16/7] max-w-full flex-col justify-end gap-0.5 bg-[linear-gradient(135deg,#0f3d2e,#1e7a55)] px-[18px] py-4 text-white">
        <span className="absolute top-3 left-3 rounded-md bg-black/35 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em]">Sponsored</span>
        <small className="text-[13px] opacity-80">Fieldnote</small>
        <b className="font-display text-[clamp(20px,3.4vw,26px)] leading-[1.05] font-semibold tracking-[-0.02em]">
          Notes that organize themselves.
        </b>
        <small className="text-[13px] opacity-80">Free for students</small>
      </div>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 font-mono text-[13px] text-muted">
        <span className="tabular-nums">0:0{Math.floor(elapsed)}</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuemin={0} aria-valuemax={SPOT_SECONDS} aria-valuenow={Math.floor(elapsed)} aria-label="Sponsor spot progress">
          <i className="block h-full rounded-full bg-accent" style={{ width: `${(elapsed / SPOT_SECONDS) * 100}%` }} />
        </div>
        <span>+{SPOT_REWARD}</span>
      </div>
    </div>
  );
}

export function WatchButton({ onClick, earned = false, className = "" }: { onClick?: () => void; earned?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={earned}
      className={`flex items-center gap-[7px] rounded-[9px] px-3 py-[7px] text-[13px] font-semibold ${earned ? "bg-hover text-good" : "bg-fg text-bg"} ${className}`}
    >
      {earned ? (
        <>
          <Icon name="check" size={15} />+{SPOT_REWARD} earned
        </>
      ) : (
        <>
          <Icon name="play" size={15} />
          Watch 20s <span className="font-mono font-medium text-accent">+{SPOT_REWARD}</span>
        </>
      )}
    </button>
  );
}

/** Shown while a job runs. The same card in every tool. */
export function SponsorCard({
  sponsor,
  spot,
  onWatch,
  onSpotDone,
}: {
  sponsor: Sponsor;
  spot: "idle" | "playing" | "earned";
  onWatch: () => void;
  onSpotDone: () => void;
}) {
  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-line bg-surface">
      {spot === "playing" ? (
        <RewardedSpot onDone={onSpotDone} />
      ) : (
        <>
          <div className="flex items-start gap-3 p-3.5">
            <Logo sponsor={sponsor} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={eyebrow}>While you wait · Sponsored</span>
              <b className="font-semibold">{sponsor.name}</b>
              <p className="text-sm text-muted">{sponsor.text}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2.5">
            <SponsorLink
              sponsor={sponsor}
              className="rounded-[9px] border border-line bg-surface px-[11px] py-[7px] text-[13px] font-medium hover:border-faint"
            />
            <WatchButton onClick={onWatch} earned={spot === "earned"} className="ml-auto" />
          </div>
        </>
      )}
    </div>
  );
}

/** What the card folds into once the result is in. */
export function SponsorLine({ sponsor, earned }: { sponsor: Sponsor; earned: boolean }) {
  return (
    <div className="flex min-w-0 animate-rise flex-wrap items-center gap-2.5 py-0.5 text-[13px] text-muted">
      <Logo sponsor={sponsor} small />
      <span className={eyebrow}>Sponsored</span>
      <span>
        <b className="font-semibold text-fg">{sponsor.name}</b> ·{" "}
        <SponsorLink sponsor={sponsor} className="text-fg underline decoration-line underline-offset-[3px] hover:decoration-faint" />
      </span>
      {earned && (
        <span className="rounded-full bg-good/12 px-[7px] py-0.5 font-mono text-[11px] text-good">+{SPOT_REWARD} earned</span>
      )}
    </div>
  );
}
