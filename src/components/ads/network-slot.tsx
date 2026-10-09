"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useWorkspace } from "@/lib/workspace-store";

/*
 * Ad-network test mode. Fills Wanlly's ad slots with Google's public test ad units through Google
 * Publisher Tag, the same code path real AdSense or Ad Manager ads will use, so the team can check
 * sizes and layout before an account is approved. Only staff see it, and only on a device where
 * they switched it on in Admin → Ads. Swap the test units for real ones when an account is live.
 */

/**
 * Google's documented sample ad unit. It serves test creatives (and never pays) at 300×250,
 * 320×50, 728×90 and 160×600; other sizes come back empty and show as a reserved box.
 */
const TEST_UNIT = "/6355419/Travel/Europe/France/Paris";
const KEY = "wanlly-network-test";
const STAFF = new Set(["owner", "admin", "support", "moderator", "analyst"]);

type Slot = { addService(s: unknown): Slot };
type Gpt = {
  cmd: (() => void)[];
  defineSlot(unit: string, size: [number, number], div: string): Slot | null;
  pubads(): { addEventListener(type: string, fn: (e: { slot: Slot; isEmpty: boolean }) => void): void };
  enableServices(): void;
  display(div: string): void;
  destroySlots(slots: Slot[]): void;
};
declare global {
  interface Window {
    googletag?: Gpt;
  }
}

const rendered = new Map<Slot, (empty: boolean) => void>();
let ready = false;

/** Loads Google Publisher Tag once and sets it up. */
function gpt(): Gpt {
  const g = (window.googletag ??= { cmd: [] } as unknown as Gpt);
  if (!ready) {
    ready = true;
    const s = document.createElement("script");
    s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
    g.cmd.push(() => {
      g.pubads().addEventListener("slotRenderEnded", (e) => rendered.get(e.slot)?.(e.isEmpty));
      g.enableServices();
    });
  }
  return g;
}

const subscribe = (fn: () => void) => {
  window.addEventListener("storage", fn);
  window.addEventListener(KEY, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(KEY, fn);
  };
};
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** The switch in Admin → Ads, for this device. */
export function useNetworkTestSwitch(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = (next: boolean) => {
    try {
      if (next) localStorage.setItem(KEY, "1");
      else localStorage.removeItem(KEY);
    } catch {}
    window.dispatchEvent(new Event(KEY));
  };
  return [on, set];
}

/** True when this device should show network test ads: switched on, and signed in as staff. */
export function useNetworkTest(): boolean {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const { me } = useWorkspace();
  return on && STAFF.has(me?.role ?? "");
}

/** One network ad of a fixed size, outlined and labelled with its size so layouts can be checked. */
export function NetworkSlot({ w, h, label, unit: pinned }: { w: number; h: number; label?: string; unit?: string }) {
  const id = `gpt-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [state, setState] = useState<"loading" | "filled" | "empty">("loading");
  useEffect(() => {
    const g = gpt();
    let slot: Slot | null = null;
    const unit = pinned ?? TEST_UNIT;
    g.cmd.push(() => {
      slot = g.defineSlot(unit, [w, h], id);
      if (!slot) return;
      slot.addService(g.pubads());
      rendered.set(slot, (empty) => setState(empty ? "empty" : "filled"));
      g.display(id);
    });
    return () => {
      g.cmd.push(() => {
        if (!slot) return;
        rendered.delete(slot);
        g.destroySlots([slot]);
      });
    };
  }, [id, w, h, pinned]);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[10px] text-faint">
        {label ? `${label} · ` : ""}
        {w}×{h} · Google test ad{state === "empty" ? " · no fill at this size" : ""}
      </span>
      <div className="relative outline-1 outline-offset-2 outline-dashed outline-accent-line" style={{ width: w, height: h }}>
        <div id={id} style={{ width: w, height: h }} />
        {state !== "filled" && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-code text-xs text-faint">{state === "loading" ? "Loading…" : `${w}×${h} reserved`}</span>
        )}
      </div>
    </div>
  );
}
