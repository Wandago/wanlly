"use client";

/* Ad impressions and clicks, queued and sent in small batches so tracking never slows the page. */

export type AdEvent = { kind: "impression" | "click"; placement: string; format: "native" | "display"; creative: string };

const queue: AdEvent[] = [];
let timer: number | null = null;

function flush() {
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 30) });
  if (!navigator.sendBeacon?.("/api/ads/events", new Blob([body], { type: "application/json" }))) {
    fetch("/api/ads/events", { method: "POST", body, keepalive: true }).catch(() => {});
  }
  if (queue.length) timer = window.setTimeout(flush, 1000);
}

const SEEN = "wanlly-ad-seen";

/** How many times this browser counted a view of `creative` today. */
export function seenToday(creative: string): number {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN) ?? "{}");
    return v.day === new Date().toISOString().slice(0, 10) ? (v.n?.[creative] ?? 0) : 0;
  } catch {
    return 0;
  }
}

/** Forgets this browser's view counts, so capped campaigns show again (for the team, testing). */
export function resetSeen() {
  try {
    localStorage.removeItem(SEEN);
  } catch {}
  window.dispatchEvent(new Event(SEEN));
}

/** Counts a view of a sold campaign, so frequency caps hold across pages and tabs. */
function countView(creative: string) {
  if (!creative.startsWith("campaign:")) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const v = JSON.parse(localStorage.getItem(SEEN) ?? "{}");
    const n = v.day === day ? (v.n ?? {}) : {};
    n[creative] = (n[creative] ?? 0) + 1;
    localStorage.setItem(SEEN, JSON.stringify({ day, n }));
  } catch {}
  window.dispatchEvent(new Event(SEEN));
}

export function trackAd(e: AdEvent) {
  if (e.kind === "impression") countView(e.creative);
  queue.push(e);
  if (e.kind === "click") return flush();
  timer ??= window.setTimeout(flush, 5000);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}
