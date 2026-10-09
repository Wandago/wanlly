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

export function trackAd(e: AdEvent) {
  queue.push(e);
  if (e.kind === "click") return flush();
  timer ??= window.setTimeout(flush, 5000);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}
