import type { MetadataRoute } from "next";
import { publishedArticles } from "@/lib/articles";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/** The public pages, Learn articles and the showcase, for search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["", "/learn", "/showcase", "/beta", "/about", "/advertise", "/contact", "/privacy", "/terms"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === "" || p === "/learn" ? "daily" : p === "/showcase" ? "weekly" : "monthly",
    priority: p ? (p === "/learn" ? 0.8 : 0.6) : 1,
  }));
  const articles = await publishedArticles(500).catch(() => []);
  return [
    ...pages,
    ...articles.map((a) => ({ url: `${SITE_URL}/learn/${a.slug}`, lastModified: a.publishedAt ?? undefined, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
