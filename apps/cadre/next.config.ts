import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wanlly/ui"],
  poweredByHeader: false,
  // pg loads pg-cloudflare's socket only on Workers, so the file tracer never sees it.
  outputFileTracingIncludes: {
    "/*": ["../../node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/**/*"],
  },
};

export default nextConfig;
