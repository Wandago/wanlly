"use client";

import { useMemo, useState } from "react";
import { creativeOf, openSponsor, useSuggested } from "@/lib/ads-context";
import { matchScore } from "@/lib/affiliates";
import { useLocalSetting } from "@/lib/use-local-setting";
import { useWorkspace } from "@/lib/workspace-store";
import { Tracked } from "./tracked";

/**
 * A sponsored suggestion under a finished AI answer, when an advertiser's topics match what was
 * asked. Kept apart from the answer (it never changes what the AI says), labelled Sponsored, with
 * Why this ad, Hide and Report. At most one per answer, none on sensitive topics.
 */
export function SuggestedAd({ context }: { context: string }) {
  const { dispatch } = useWorkspace();
  const [hiddenRaw, setHidden] = useLocalSetting("wanlly-hidden-advertisers", "");
  const hidden = useMemo(() => (hiddenRaw ? hiddenRaw.split("|") : []), [hiddenRaw]);
  const ad = useSuggested(context, hidden);
  const [menu, setMenu] = useState<null | "menu" | "why" | "report">(null);
  const [reason, setReason] = useState("");
  if (!ad) return null;
  const words = ` ${context.toLowerCase().replace(/[^a-z0-9+#]+/g, " ")} `;
  const matched = (ad.keywords ?? []).filter((k) => matchScore([k], words) > 0).slice(0, 4);

  const report = async () => {
    await fetch("/api/ads/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creative: creativeOf(ad), advertiser: ad.name, reason }) }).catch(() => null);
    setHidden([...hidden, ad.name].join("|"));
    dispatch({ type: "toast", text: "Thanks. The ad is hidden and our team will review it." });
  };

  return (
    <Tracked placement="suggested" format="native" creative={creativeOf(ad)} className="relative">
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5 sm:flex-row sm:items-center">
        {ad.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: ad.color }}>
            {ad.initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <b className="truncate text-[13px] font-semibold">{ad.name}</b>
            <span className="tracking-[0.07em] text-faint uppercase">Sponsored</span>
          </div>
          <p className="text-[14px] font-medium">{ad.headline}</p>
          {ad.text && <p className="text-[13px] text-muted">{ad.text}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => openSponsor(ad, "suggested") || dispatch({ type: "toast", text: `Opens ${ad.name}` })}
            className="rounded-lg bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90"
          >
            {ad.cta}
          </button>
          <button type="button" data-ad-ignore aria-label="Ad options" aria-expanded={!!menu} onClick={() => setMenu(menu ? null : "menu")} className="rounded-lg px-2 py-1.5 text-muted hover:bg-hover hover:text-fg">
            ⋯
          </button>
        </div>
      </div>
      {menu && (
        <div className="absolute right-2 top-full z-20 mt-1 flex w-[260px] flex-col gap-1 rounded-xl border border-line bg-surface p-2 text-[13px] shadow-soft">
          {menu === "menu" && (
            <>
              <button type="button" data-ad-ignore onClick={() => setMenu("why")} className="rounded-lg px-2 py-1.5 text-left hover:bg-hover">
                Why this ad
              </button>
              <button type="button" data-ad-ignore onClick={() => (setHidden([...hidden, ad.name].join("|")), setMenu(null))} className="rounded-lg px-2 py-1.5 text-left hover:bg-hover">
                Hide ads from {ad.name}
              </button>
              <button type="button" data-ad-ignore onClick={() => setMenu("report")} className="rounded-lg px-2 py-1.5 text-left text-bad hover:bg-hover">
                Report this ad
              </button>
            </>
          )}
          {menu === "why" && (
            <div className="flex flex-col gap-1.5 px-2 py-1">
              <p>
                It matches what you asked about{matched.length ? `: ${matched.join(", ")}` : ""}.
              </p>
              <p className="text-xs text-muted">Ads never change the AI&apos;s answer, and advertisers never see your chats.</p>
              <button type="button" data-ad-ignore onClick={() => setMenu(null)} className="self-start text-xs underline underline-offset-2">
                Close
              </button>
            </div>
          )}
          {menu === "report" && (
            <div className="flex flex-col gap-1.5 px-1 py-1">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="What's wrong with it? (optional)" className="w-full resize-none rounded-lg border border-line bg-bg px-2 py-1.5 text-[13px] outline-none" />
              <button type="button" data-ad-ignore onClick={() => void report()} className="self-start rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold text-bg">
                Report and hide
              </button>
            </div>
          )}
        </div>
      )}
    </Tracked>
  );
}
