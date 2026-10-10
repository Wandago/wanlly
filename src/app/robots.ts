import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/build", "/design", "/projects", "/profile", "/coworkers", "/admin", "/api", "/dev", "/s/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
