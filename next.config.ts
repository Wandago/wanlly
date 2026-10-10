import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents and partialPrefetching stay off: with them on, every page hangs on Cloudflare
  // (@opennextjs/cloudflare 1.20.9). Turn them back on once the adapter supports them.
  // One address: www.wanlly.africa sends people (and search engines) to wanlly.africa.
  // Wanlly's pages never load inside a frame (another site's, or a Builder preview whose code
  // navigates to "/" or "page.html"): they'd count fake visits and ad views, and framing is how
  // click-tricking works. Wanlly's own ad frame and published sites keep their own rules.
  async headers() {
    return [
      {
        source: "/((?!api/ads/unit|s/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "www.wanlly.africa" }], destination: "https://wanlly.africa/:path*", permanent: true },
      // The old workers.dev address: sign-in only works on wanlly.africa, so everyone goes there.
      { source: "/:path*", has: [{ type: "host", value: "wanlly.louiswandago.workers.dev" }], destination: "https://wanlly.africa/:path*", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
