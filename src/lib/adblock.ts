"use client";

/*
 * Is an ad blocker active? Wanlly is paid for by ads, so the app needs them to run. Three
 * independent checks; any one is enough:
 *  1. Bait: an element with the class names ad blockers hide. If it comes back hidden, a
 *     cosmetic filter is running.
 *  2. Wanlly's own ad files: a request to /api/ads/image, the kind of address blockers stop.
 *  3. Ad networks: a request to Google's ad script, which almost every blocker (and blocking DNS)
 *     refuses.
 * Network checks only count when a plain request to Wanlly works, so being offline isn't
 * mistaken for a blocker.
 */

function baitHidden(): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement("div");
    bait.className = "adsbox ad-banner ad-placement textads banner-ads pub_300x250 sponsored-ad";
    bait.setAttribute("aria-hidden", "true");
    bait.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:300px;height:10px;";
    bait.innerHTML = "&nbsp;";
    document.body.appendChild(bait);
    // Cosmetic filters apply shortly after the element appears.
    window.setTimeout(() => {
      const cs = getComputedStyle(bait);
      const hidden = bait.offsetHeight === 0 || cs.display === "none" || cs.visibility === "hidden" || !bait.isConnected;
      bait.remove();
      resolve(hidden);
    }, 250);
  });
}

/** True when the request never reached a server (blocked by an extension, DNS or the browser). */
async function refused(url: string, init: RequestInit = {}): Promise<boolean> {
  try {
    await fetch(url, { cache: "no-store", ...init });
    return false;
  } catch {
    return true;
  }
}

export async function adBlockerActive(): Promise<boolean> {
  const [bait, ownAds, network, control] = await Promise.all([
    baitHidden(),
    refused("/api/ads/image/0?check=1"),
    refused("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", { mode: "no-cors" }),
    refused("/api/me"),
  ]);
  // Offline, or Wanlly itself unreachable: don't blame a blocker.
  if (control && !bait) return false;
  return bait || ownAds || network;
}
