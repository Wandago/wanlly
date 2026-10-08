import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents and partialPrefetching stay off: with them on, every page hangs on Cloudflare
  // (@opennextjs/cloudflare 1.20.9). Turn them back on once the adapter supports them.
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
