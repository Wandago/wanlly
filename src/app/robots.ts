import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/design", "/projects", "/profile", "/coworkers", "/admin", "/api", "/dev"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
