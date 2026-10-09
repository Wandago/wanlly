"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Records one page view per page, without cookies. Skipped for Do Not Track and the admin pages. */
export function PageBeacon() {
  const path = usePathname();
  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl || path.startsWith("/admin")) return;
    const utm = new URLSearchParams(window.location.search).get("utm_source") ?? "";
    const body = JSON.stringify({ p: path, r: document.referrer, u: utm });
    if (!nav.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) {
      fetch("/api/t", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [path]);
  return null;
}
