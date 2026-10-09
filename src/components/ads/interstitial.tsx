"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { RAIL_SPONSORS } from "@/lib/catalog";
import { creativeOf, openSponsor, useSponsors } from "@/lib/ads-context";
import { useWorkspace } from "@/lib/workspace-store";
import { Icon } from "../icon";
import { Cover } from "./cover";
import { Tracked } from "./tracked";

/*
 * Pop-up sponsor card, shown only at natural breaks (a reply or a design has just finished).
 * Kept polite with caps: never in the first breaks of a visit, at most one every 8 minutes and
 * 6 a day, never while someone is typing or another dialog is open. It can be closed after 5 s.
 */

/** Something just finished: a good moment for a pop-up. Called by chat and the design editor. */
export function naturalBreak() {
  window.dispatchEvent(new Event("wanlly:break"));
}

const GAP_MS = 8 * 60_000;
const PER_DAY = 6;
const SKIP_FIRST = 2;
const WAIT_S = 5;
const KEY = "wanlly-popups";

function readLog(): { day: string; count: number; last: number } {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v.day === day ? v : { day, count: 0, last: 0 };
  } catch {
    return { day, count: 0, last: 0 };
  }
}

function typing() {
  const el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
  return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && el.value.trim().length > 0;
}

export function Interstitial() {
  const { earnOpen, dispatch } = useWorkspace();
  const sponsors = useSponsors("interstitial", RAIL_SPONSORS);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(WAIT_S);
  const [pick, setPick] = useState(0);
  const breaks = useRef(0);
  const blocked = useRef(earnOpen);
  useEffect(() => {
    blocked.current = earnOpen;
  }, [earnOpen]);

  useEffect(() => {
    let timer: number | null = null;
    const onBreak = () => {
      breaks.current += 1;
      if (breaks.current <= SKIP_FIRST) return;
      const log = readLog();
      if (log.count >= PER_DAY || Date.now() - log.last < GAP_MS) return;
      if (timer) window.clearTimeout(timer);
      // A moment later, so the finished result is seen first.
      timer = window.setTimeout(() => {
        if (document.visibilityState !== "visible" || blocked.current || typing() || document.querySelector("[role=dialog]")) return;
        try {
          localStorage.setItem(KEY, JSON.stringify({ day: log.day, count: log.count + 1, last: Date.now() }));
        } catch {}
        setPick((n) => n + 1);
        setLeft(WAIT_S);
        setOpen(true);
      }, 1500);
    };
    window.addEventListener("wanlly:break", onBreak);
    return () => {
      window.removeEventListener("wanlly:break", onBreak);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!open || left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [open, left]);

  const sponsor = sponsors[pick % sponsors.length];
  const canClose = left <= 0;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o || canClose) && setOpen(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(8_9_12/0.5)]" />
        <Dialog.Content
          onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
          onPointerDownOutside={(e) => !canClose && e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-50 w-[400px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 animate-rise outline-none"
        >
          <Tracked key={creativeOf(sponsor)} placement="interstitial" format="native" creative={creativeOf(sponsor)}>
            <article className="overflow-hidden rounded-[22px] border border-line bg-surface text-fg shadow-soft">
              <div className="relative">
                <Cover sponsor={sponsor} />
                <Dialog.Close
                  disabled={!canClose}
                  data-ad-ignore
                  aria-label={canClose ? "Close" : `You can close this in ${left} seconds`}
                  className="absolute top-3 right-3 flex h-8 min-w-8 items-center justify-center gap-1 rounded-full bg-black/55 px-2.5 font-mono text-xs text-white backdrop-blur-sm enabled:hover:bg-black/75"
                >
                  {canClose ? <Icon name="x" size={15} /> : <span className="tabular-nums">{left}</span>}
                </Dialog.Close>
              </div>
              <div className="flex flex-col gap-2 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: sponsor.color }} aria-hidden="true">
                    {sponsor.initial}
                  </span>
                  <b className="text-[13px] font-semibold">{sponsor.name}</b>
                  <span className="ml-auto text-[11px] tracking-[0.07em] text-faint uppercase">Sponsored</span>
                </div>
                <Dialog.Title className="font-display text-xl leading-tight font-semibold tracking-[-0.02em]">{sponsor.headline}</Dialog.Title>
                <Dialog.Description className="text-[14px] leading-snug text-muted">{sponsor.text || "Thanks to sponsors like this one, Wanlly stays free."}</Dialog.Description>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!openSponsor(sponsor, "interstitial")) dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` });
                    }}
                    className="rounded-[10px] bg-fg px-4 py-2 text-[14px] font-semibold text-bg"
                  >
                    {sponsor.cta}
                  </button>
                  <span className="ml-auto text-xs text-faint">{canClose ? "Thanks for supporting Wanlly" : `Close in ${left}s`}</span>
                </div>
              </div>
            </article>
          </Tracked>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
