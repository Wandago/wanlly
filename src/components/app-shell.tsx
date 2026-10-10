"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-store";
import { RAIL_SPONSORS } from "@/lib/catalog";
import { applyTheme, type Settings } from "@/lib/settings";
import { AdRail } from "./ads/rail";
import { DisplayCreative } from "./ads/creatives";
import { Tracked } from "./ads/tracked";
import { NetworkSlot, useNetworkTest } from "./ads/network-slot";
import { AdsProvider, creativeOf, openSponsor, useNetwork, useSponsors } from "@/lib/ads-context";
import { NetworkUnit } from "./ads/network-unit";
import { EarnDialog } from "./earn-dialog";
import { PhoneVerifyDialog } from "./phone-verify";
import { Interstitial } from "./ads/interstitial";
import { AdBlockWall } from "./ads/adblock-wall";
import { Sidebar } from "./sidebar";
import { BetaWaiting } from "./beta-waiting";

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
 * Every signed-in page: sidebar on the left, the page in the middle, and a sponsor panel on the
 * right from 1280px. The design editor needs the width for its preview, so there the panel waits
 * for 1536px screens. The panels are part of the layout, so ads never cover or push the work.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const roomy = usePathname().startsWith("/design/");
  // With an ad blocker on, the app underneath can't be used until ads are allowed.
  const [walled, setWalled] = useState(false);
  // Signed in, but their place in the private beta hasn't opened yet.
  const [waiting, setWaiting] = useState<{ email: string | null } | null>(null);
  const onWaiting = useCallback((email: string | null) => setWaiting({ email }), []);
  return (
    <WorkspaceProvider>
      <AdsProvider>
        <div
          inert={walled || !!waiting}
          aria-hidden={walled || !!waiting || undefined}
          className={`grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-1 ${roomy ? "2xl:grid-cols-[240px_minmax(0,1fr)_344px]" : "xl:grid-cols-[240px_minmax(0,1fr)_344px]"}`}
        >
          <Sidebar />
          <div className="min-h-0 min-w-0">{children}</div>
          <AdRail wideOnly={roomy} />
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
