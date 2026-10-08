import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache for now; pages are prerendered and the rest is dynamic.
export default defineCloudflareConfig({});
