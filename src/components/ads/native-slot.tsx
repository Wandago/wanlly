"use client";

import { useEffect, useRef, useState } from "react";
import { frameUrl } from "@/lib/ad-network";
import { markNetworkEmpty, useNetwork } from "@/lib/ads-context";
import { DIRECT_SANDBOX } from "./network-unit";
import { Tracked } from "./tracked";

/**
 * The ad network's native row (a few picture-and-headline ads that sit with the content), full
 * width at the height set in Admin. Loaded from the banner host like any network script; hidden
 * until it shows something, and handed back to `fallback` if it comes back empty.
 */
export function NativeSlot({ placement, fallback = null }: { placement: string; fallback?: React.ReactNode }) {
  const net = useNetwork();
  const name = net?.native?.name ?? "";
  const frame = useRef<HTMLIFrameElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = (e.data as { wanllyAd?: string })?.wanllyAd;
      if (m === "filled") setFilled(true);
      if (m === "empty" && name) markNetworkEmpty(name, "native");
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [name]);
  if (!net?.native || !net.host) return <>{fallback}</>;
  return (
    <Tracked placement={placement} format="native" creative={`network:${name || "network"}`} paused={!filled} className="w-full">
      <div className={`flex flex-col gap-1.5 ${filled ? "" : "h-0 overflow-hidden"}`}>
        <span className="text-[11px] tracking-[0.07em] text-faint uppercase">Sponsored</span>
        <iframe key={name} ref={frame} title="Sponsored links" src={frameUrl(net.host, net.native.code)} sandbox={DIRECT_SANDBOX} className="block w-full rounded-xl border-0" style={{ height: net.native.height, colorScheme: "normal" }} />
      </div>
      {!filled && fallback}
    </Tracked>
  );
}
