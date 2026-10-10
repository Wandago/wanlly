"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { SPOT_SPONSOR } from "@/lib/catalog";
import { useReward, useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "./icon";
import { RewardedSpot } from "./ads/ad-slot";
import { useOffers } from "@/lib/ads-context";
import { SAY } from "@/lib/messages";

function Option({
  icon,
  title,
  detail,
  gain,
  onClick,
  locked,
  children,
}: {
  icon: IconName;
  title: string;
  detail: string;
  gain: number | string;
  onClick?: () => void;
  locked?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-hover">
        <Icon name={icon} />
      </span>
      <span className="min-w-0">
        <b className="block font-semibold">{title}</b>
        <small className="text-[13px] text-muted">{detail}</small>
        {children}
      </span>
      <span className={`font-mono text-[13px] font-medium ${locked ? "text-faint" : "text-accent"}`}>{typeof gain === "number" ? `+${gain}` : gain}</span>
    </>
  );
  const cls = "grid w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-line p-3 text-left";
  return onClick && !locked ? (
    <button type="button" onClick={onClick} className={`${cls} hover:border-faint`}>
      {body}
    </button>
  ) : (
    <div className={`${cls} ${locked ? "opacity-60" : ""}`}>{body}</div>
  );
}

/** Account-level earning. Jobs use the inline slot on their working card instead. */
export function EarnDialog() {
  const { perAd: SPOT_REWARD, floor: FLOOR_CREDITS } = useReward();
  const { earnOpen, floorUnlocked, dispatch } = useWorkspace();
  const [playing, setPlaying] = useState<null | "self">(null);
  const close = () => dispatch({ type: "setEarnOpen", open: false });
  const offers = useOffers();
  // The partner's page opens in a new tab with a one-time click id, so their confirmation can
  // credit this person. Opened first, then pointed at the link, so pop-up blockers allow it.
  const startOffer = async (id: string) => {
    const tab = window.open("about:blank", "_blank");
    const r = await fetch(`/api/offers/${encodeURIComponent(id)}/click`, { method: "POST" }).catch(() => null);
    const b = await r?.json().catch(() => ({}));
    if (r?.ok && b?.url && tab) {
      tab.opener = null;
      tab.location.href = b.url;
      dispatch({ type: "toast", text: "Credits arrive once the sponsor confirms your sign-up" });
    } else {
      tab?.close();
      dispatch({ type: "toast", text: b?.error ?? SAY.offline });
    }
  };

  return (
    <Dialog.Root
      open={earnOpen}
      onOpenChange={(open) => {
        dispatch({ type: "setEarnOpen", open });
        if (!open) setPlaying(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_9_12/0.45)]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-5 text-fg shadow-soft">
          {playing ? (
            <>
              <Dialog.Title className="sr-only">Sponsor spot</Dialog.Title>
              <div className="overflow-hidden rounded-[14px] border border-line">
                <RewardedSpot
                  aspect="16:9"
                  sponsor={SPOT_SPONSOR}
                  placement="earn_dialog"
                  onDone={() => {
                    setPlaying(null);
                    close();
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <header className="flex items-start gap-3">
                <div>
                  <Dialog.Title className="font-display text-lg font-semibold tracking-[-0.02em]">Earn credits</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-[13px] text-muted">No free credits: every one is paid for by a sponsor you chose to see.</Dialog.Description>
                </div>
                <Dialog.Close aria-label="Close" className="ml-auto grid size-[34px] place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
                  <Icon name="x" />
                </Dialog.Close>
              </header>
              {floorUnlocked ? (
                <Option icon="play" title="Watch an ad" detail="Or press Watch on any working card" gain={SPOT_REWARD} onClick={() => setPlaying("self")} />
              ) : (
                <Option icon="play" title="Today's first ad" detail="Your first ad each day earns a bonus" gain={FLOOR_CREDITS} onClick={() => setPlaying("self")} />
              )}
              {offers.length ? (
                offers.map((o) => (
                  <Option
                    key={o.affiliateId}
                    icon="gift"
                    title={o.headline}
                    detail={`${o.name} · credits arrive once ${o.name} confirms your sign-up`}
                    gain={o.offerCredits ?? 0}
                    onClick={() => startOffer(o.affiliateId!)}
                  />
                ))
              ) : (
                <Option icon="gift" title="Try a sponsor's tool" detail="Sign up for a tool a sponsor offers and earn credits" gain="Soon" locked />
              )}
              <Option
                icon="search"
                title="Answer a short survey"
                detail="Pays more than an ad · credits arrive when the survey company confirms"
                gain="Soon"
                locked
              />
              <Option icon="flame" title="Daily streak" detail="Watch on five days in a row for a bonus Opus answer" gain="Soon" locked />
              <p className="border-t border-line pt-3 text-xs text-faint">
                Sponsors never appear inside an answer and never change what a model says.
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
