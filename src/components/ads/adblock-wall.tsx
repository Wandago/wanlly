"use client";

import { useCallback, useEffect, useState } from "react";
import { adBlockerActive } from "@/lib/adblock";
import { Icon } from "../icon";

/*
 * Wanlly runs on ads: they pay for the models. With an ad blocker on, the app is covered by this
 * panel until Wanlly is allowed. Checked on load, when the tab comes back, and on "Check again".
 */

const STEPS: [string, string][] = [
  ["uBlock Origin", "Click its icon, then the big power button so it turns grey, then reload."],
  ["AdBlock / Adblock Plus", "Click its icon and choose “Pause on this site” or “Don’t run on pages on this site”."],
  ["Brave", "Click the lion icon in the address bar and turn Shields off for this site."],
  ["Opera, Edge, others", "Turn off the browser’s built-in ad blocker or tracking prevention for this site."],
];

export function AdBlockWall({ onChange }: { onChange?: (blocked: boolean) => void }) {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillOn, setStillOn] = useState(false);

  const check = useCallback(
    async (fromButton = false) => {
      setChecking(true);
      const on = await adBlockerActive();
      setBlocked(on);
      onChange?.(on);
      setStillOn(fromButton && on);
      setChecking(false);
    },
    [onChange],
  );

  useEffect(() => {
    const first = window.setTimeout(() => check(), 600);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!blocked) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="adblock-title" className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-bg/95 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-[520px] flex-col gap-4 rounded-[22px] border border-line bg-surface p-6 shadow-soft">
        <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="shield" size={20} />
        </span>
        <h2 id="adblock-title" className="font-display text-[22px] leading-tight font-semibold tracking-[-0.02em]">
          Please allow ads on Wanlly
        </h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Wanlly is free because sponsors pay for the AI you use. With an ad blocker on, they can&apos;t, so Wanlly can&apos;t run. Our ads stay beside your work, never inside answers, with no pop-unders or redirects.
        </p>
        <ul className="flex flex-col gap-2.5 border-t border-line pt-4">
          {STEPS.map(([name, how]) => (
            <li key={name} className="text-[13px]">
              <b className="font-semibold">{name}</b>
              <span className="text-muted"> · {how}</span>
            </li>
          ))}
        </ul>
        {stillOn && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">Ads are still blocked. Allow Wanlly in your blocker, reload the page, then check again.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => check(true)} disabled={checking} className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
            {checking ? "Checking…" : "I've allowed ads · Check again"}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium hover:border-faint">
            Reload
          </button>
        </div>
        <p className="text-xs text-faint">Using a school or office network that blocks ads? Try mobile data.</p>
      </div>
    </div>
  );
}
