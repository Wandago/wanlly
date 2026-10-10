/**
 * The site's public address, for share previews, the sitemap and robots.txt. Set
 * NEXT_PUBLIC_SITE_URL as a build variable when the domain changes; it is read at build time.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://wanlly.africa").replace(/\/+$/, "");
