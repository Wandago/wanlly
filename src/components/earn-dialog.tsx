"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { FLOOR_CREDITS, SPONSOR_TRIAL_REWARD, SPOT_REWARD, SPOT_SPONSOR } from "@/lib/catalog";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon, type IconName } from "./icon";
import { RewardedSpot } from "./ads/ad-slot";

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
  const { earnOpen, floorUnlocked, dispatch } = useWorkspace();
  const [playing, setPlaying] = useState<null | "self">(null);
  const close = () => dispatch({ type: "setEarnOpen", open: false });

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
                  onDone={() => {
                    dispatch(floorUnlocked ? { type: "earn", amount: SPOT_REWARD } : { type: "unlockFloor" });
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
                <Option icon="play" title="Watch a 20s video" detail="Or press Watch on any working card" gain={SPOT_REWARD} onClick={() => setPlaying("self")} />
              ) : (
                <Option icon="play" title="Today's first video" detail="Your first video each day earns a bonus" gain={FLOOR_CREDITS} onClick={() => setPlaying("self")} />
              )}
              <Option
                icon="gift"
                title="Try a sponsor's tool"
                detail="Northbeam DB · create a free database"
                gain={SPONSOR_TRIAL_REWARD}
                onClick={() => {
                  dispatch({ type: "earn", amount: SPONSOR_TRIAL_REWARD, note: "sponsor trial" });
                  close();
                }}
              />
              <Option
                icon="search"
                title="Answer a short survey"
                detail="Pays more than a video · credits arrive when the survey company confirms"
                gain={30}
                onClick={() => dispatch({ type: "toast", text: "Opens a survey. Credits arrive once it's confirmed" })}
              />
              <Option icon="flame" title="Daily streak · 3 of 5" detail="Two more days for a bonus Fable 5.1 answer" gain={10}>
                <span className="mt-1.5 flex gap-1.5" aria-label="3 of 5 days">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <i key={i} className={`h-[5px] flex-1 rounded-full ${i < 3 ? "bg-accent" : "bg-hover"}`} />
                  ))}
                </span>
              </Option>
              <p className="border-t border-line pt-3 text-xs text-faint">
                Sponsors never appear inside an answer and never change what a model says. Rewards follow what each video pays where you are.
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
