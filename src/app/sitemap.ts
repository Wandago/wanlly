import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/beta", "/about", "/advertise", "/contact", "/privacy", "/terms"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: p ? "monthly" : "weekly", priority: p ? 0.6 : 1 }));
}
