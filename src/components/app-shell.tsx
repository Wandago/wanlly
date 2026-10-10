"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-store";
import { RAIL_SPONSORS } from "@/lib/catalog";
import { applyTheme, type Settings } from "@/lib/settings";
import { AdRail, RAIL_SETTING } from "./ads/rail";
import { DisplayCreative } from "./ads/creatives";
import { Tracked } from "./ads/tracked";
import { NetworkSlot, useNetworkTest } from "./ads/network-slot";
import { AdsProvider, creativeOf, openSponsor, useNetwork, useSponsors } from "@/lib/ads-context";
import { NetworkUnit } from "./ads/network-unit";
import { DisplaySlot } from "./ads/display-slot";
import { EarnDialog } from "./earn-dialog";
import { PhoneVerifyDialog } from "./phone-verify";
import { Interstitial } from "./ads/interstitial";
import { AdBlockWall } from "./ads/adblock-wall";
import { Sidebar } from "./sidebar";
import { BetaWaiting } from "./beta-waiting";
import { Icon } from "./icon";
import { useLocalSetting } from "@/lib/use-local-setting";

function Toast() {
  const { toast } = useWorkspace();
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-[13px] text-bg shadow-soft"
    >
      {toast.text}
    </div>
  );
}

/**
 * Saves the signed-in person to our database on every visit (and their country, the first time),
 * so nobody depends on the Clerk webhook arriving. Credits on screen are still the demo until Step 3.
 */
function AccountSync({ onWaiting }: { onWaiting: (email: string | null) => void }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { dispatch } = useWorkspace();
  const router = useRouter();
  // Signed-out visitors go to sign-in. Data is protected on the server; this just keeps the UI honest.
  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
  }, [isLoaded, isSignedIn, router]);
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) return console.warn("Account sync:", r.status, b?.error);
        if (b.access === "waiting") onWaiting(b.email ?? null);
        dispatch({ type: "account", credits: b.credits, floorUnlocked: b.floorUnlocked, usage: b.usage, me: { country: b.country, status: b.status, role: b.role }, providers: b.providers });
        dispatch({ type: "memory", memory: b.memory ?? null });
        // Settings load after /api/me, which creates the account row on a first visit.
        const s = await fetch("/api/me/settings", { cache: "no-store" });
        if (!s.ok) return;
        const settings: Settings = await s.json();
        applyTheme(settings.theme);
        dispatch({ type: "settings", settings, first: true });
      })
      .catch(() => console.warn("Account sync: network error"));
  }, [isSignedIn, userId, dispatch, onWaiting]);
  return null;
}

/**
 * Sends a fresh sign-in token with every request to Wanlly's own API. The session cookie alone can
 * be a minute stale (or left over from an older sign-in setup), which the server rightly refuses;
 * a token from Clerk is always current, and the server prefers it over the cookie.
 */
function AuthFetch() {
  const { getToken } = useAuth();
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return original(input, init);
      const token = await getToken().catch(() => null);
      if (!token) return original(input, init);
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
      return original(input, { ...init, headers });
    };
    return () => {
      window.fetch = original;
    };
  }, [getToken]);
  return null;
}

/** Phones have no side panels, so a 320×50 banner sits in a rounded tray at the bottom. */
function PhoneBanner() {
  const { dispatch } = useWorkspace();
  const sponsor = useSponsors("phone_banner", RAIL_SPONSORS)[0];
  const networkTest = useNetworkTest();
  const network = useNetwork();
  // A sold campaign keeps the phone bar; otherwise the network's banner, then house sponsors.
  if (network?.sizes.includes("320x50") && !sponsor.campaignId && !networkTest)
    return (
      <div className="flex justify-center border-t border-line bg-side px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] md:hidden" aria-label="Advertisement">
        <NetworkUnit size="320x50" network={network.name} placement="phone_banner" />
      </div>
    );
  if (networkTest)
    return (
      <div className="flex justify-center border-t border-line bg-side px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] md:hidden">
        <NetworkSlot w={320} h={50} label="Phone banner" />
      </div>
    );
  return (
    <div className="flex items-center justify-center border-t border-line bg-side px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] md:hidden" aria-label="Sponsored">
      <Tracked key={creativeOf(sponsor)} placement="phone_banner" format="display" creative={creativeOf(sponsor)} className="overflow-hidden rounded-xl">
        <button
          type="button"
          aria-label={`${sponsor.name}: ${sponsor.cta}`}
          onClick={() => openSponsor(sponsor, "phone_banner") || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}
          className="block"
        >
          <DisplayCreative size="320x50" sponsor={sponsor} />
        </button>
      </Tracked>
    </div>
  );
}

/**
 * Tablets and laptops (768–1279px, or up to 1535px in the design editor) have no right panel, so
 * a banner strip sits under the page: a sold campaign first, then the ad network, then a house sponsor.
 */
function TabletBanner({ roomy, always }: { roomy: boolean; always?: boolean }) {
  const { dispatch } = useWorkspace();
  const sponsor = useSponsors("tablet_banner", RAIL_SPONSORS)[0];
  return (
    <div className={`hidden justify-center border-t border-line bg-side px-4 py-1.5 md:flex ${always ? "" : roomy ? "2xl:hidden" : "xl:hidden"}`} aria-label="Advertisement">
      <DisplaySlot
        placement="tablet_banner"
        // In the Builder the strip stays slim (60px tall at most) so the work keeps the room.
        sizes={always ? ["468x60", "320x50"] : ["728x90", "468x60", "320x100", "320x50"]}
        label=""
        fallback={
          <Tracked key={creativeOf(sponsor)} placement="tablet_banner" format="display" creative={creativeOf(sponsor)} className="overflow-hidden rounded-xl">
            <button
              type="button"
              aria-label={`${sponsor.name}: ${sponsor.cta}`}
              onClick={() => openSponsor(sponsor, "tablet_banner") || dispatch({ type: "toast", text: `Opens ${sponsor.name} in a new tab` })}
              className="block"
            >
              <DisplayCreative size="320x50" sponsor={sponsor} />
            </button>
          </Tracked>
        }
      />
    </div>
  );
}

/**
 * Every signed-in page: sidebar on the left, the page in the middle, and a sponsor panel on the
 * right from 1280px. The design editor needs the width for its preview, so there the panel waits
 * for 1536px screens. The panels are part of the layout, so ads never cover or push the work.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // The design editor and the Builder need the width for their previews: their side panel waits for 1536px screens.
  const path = usePathname();
  // The left menu can be hidden on a computer for more room; remembered in this browser.
  const [menu, setMenu] = useLocalSetting("wanlly-menu", "shown");
  const roomy = path.startsWith("/design/");
  // The Builder has no side panel at all: its ads sit in a strip under the page and in the
  // Builder's own slots, so nothing sits beside the work.
  const builder = /^\/build\/\d/.test(path);
  const [rail] = useLocalSetting(RAIL_SETTING, "full");
  const railW = rail === "slim" ? "184px" : "344px";
  // With an ad blocker on, the app underneath can't be used until ads are allowed.
  const [walled, setWalled] = useState(false);
  // Signed in, but their place in the private beta hasn't opened yet.
  const [waiting, setWaiting] = useState<{ email: string | null } | null>(null);
  const onWaiting = useCallback((email: string | null) => setWaiting({ email }), []);
  return (
    <WorkspaceProvider>
      <AdsProvider>
        {/* First, so its effect runs before any other part of the page asks the API for anything. */}
        <AuthFetch />
        <div
          inert={walled || !!waiting}
          aria-hidden={walled || !!waiting || undefined}
          className={`grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[var(--side-w)_minmax(0,1fr)] md:grid-rows-1 ${builder ? "" : roomy ? "2xl:grid-cols-[var(--side-w)_minmax(0,1fr)_var(--rail-w)]" : "xl:grid-cols-[var(--side-w)_minmax(0,1fr)_var(--rail-w)]"}`}
          style={{ "--side-w": menu === "hidden" ? "0px" : "240px", "--rail-w": railW } as React.CSSProperties}
        >
          <Sidebar />
          {/* With the menu hidden on a computer, a small button brings it back. */}
          {menu === "hidden" && (
            <button
              type="button"
              onClick={() => setMenu("shown")}
              aria-label="Show the menu"
              title="Show the menu"
              className="fixed top-2.5 left-2.5 z-30 hidden size-8 place-items-center rounded-lg border border-line bg-surface text-muted shadow-soft hover:text-fg md:grid"
            >
              <Icon name="menu" size={16} />
            </button>
          )}
          <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] md:col-start-2 md:row-start-1">
            <div className="min-h-0 min-w-0">{children}</div>
            <TabletBanner roomy={roomy} always={builder} />
          </div>
          {!builder && <AdRail wideOnly={roomy} />}
          <PhoneBanner />
        </div>
        <AdBlockWall onChange={setWalled} />
        <EarnDialog />
        <PhoneVerifyDialog />
        <Interstitial />
        <Toast />
        <AccountSync onWaiting={onWaiting} />
        {waiting && <BetaWaiting email={waiting.email} />}
      </AdsProvider>
    </WorkspaceProvider>
  );
}
