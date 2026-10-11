import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Pages built ahead of time (/, /app, /build…) are served straight from Workers static assets, so a
// visit doesn't re-render the page: that kept CPU over the free plan's limit (error 1102). Wanlly
// has no revalidation, so a read-only cache is enough; R2 can replace it if that changes.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
