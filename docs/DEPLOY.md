# Deploying Wanlly

Wanlly runs on **Cloudflare Workers** (free plan) using the OpenNext adapter. Every push to the chosen branch builds and deploys automatically.

## One-time setup (Cloudflare dashboard)

1. **Workers & Pages → Create → Import a repository.** Connect GitHub and pick `wandago/wanlly`.
2. **Project name:** `wanlly` (it must match `name` in `wrangler.jsonc`).
3. **Production branch:** `feature/ui-shell` for now (switch to `main` once it's merged).
4. **Build command:** `npx opennextjs-cloudflare build`
5. **Deploy command:** `npx opennextjs-cloudflare deploy`
6. **Build variables** (Settings → Build → Variables and secrets). `NEXT_PUBLIC_` values are baked into the page at build time, so they go here:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
7. **Runtime secrets** (Settings → Variables and secrets, type **Secret**):
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL` (Neon pooled connection string)
   - `CLERK_WEBHOOK_SIGNING_SECRET` (after step 8)
8. Deploy. The site is live at `https://wanlly.<your-subdomain>.workers.dev`.

## Clerk webhook (after the first deploy)

Clerk dashboard → **Webhooks → Add endpoint**:
- **URL:** `https://wanlly.<your-subdomain>.workers.dev/api/webhooks/clerk`
- **Events:** `user.created`, `user.updated`, `user.deleted`
- Copy the endpoint's **Signing secret** (starts with `whsec_`) into the Cloudflare secret `CLERK_WEBHOOK_SIGNING_SECRET`, then redeploy.

Also add the workers.dev address to Clerk's allowed origins if Clerk asks for it.

## Domain: wanlly.africa

The domain is registered with HostAfrica, whose Web_Starter plan hosts email only (it can't run
the app). The site stays on Cloudflare; email stays at HostAfrica.

1. **Cloudflare → Add a domain** → `wanlly.africa` → Free plan. Cloudflare copies the existing DNS
   records. Check the mail records came across: `MX` → `mail.wanlly.africa`, the `A` record for
   `mail` (HostAfrica's server IP) and any `TXT` (SPF/DKIM) records. Mail records stay **DNS only**
   (grey cloud). Delete any `A`/`CNAME` for `wanlly.africa` and `www` that point at HostAfrica.
2. **HostAfrica client area → Domains → wanlly.africa → Nameservers** → use the two Cloudflare gives
   you (instead of dan1/dan2.host-ww.net). Wait until Cloudflare says the domain is **Active**.
3. **Workers & Pages → wanlly → Settings → Domains & Routes → Add → Custom domain**: add
   `wanlly.africa`, then `www.wanlly.africa` (the app redirects www to the bare domain).
4. **Build variable** `NEXT_PUBLIC_SITE_URL` = `https://wanlly.africa`, then redeploy.
5. **Clerk:** create the **Production** instance on `wanlly.africa`, add the DNS records Clerk lists
   (DNS only), and swap `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (build variable) and `CLERK_SECRET_KEY`
   (secret) for the production `pk_live_`/`sk_live_` keys. Re-add the webhook on the new domain and
   update `CLERK_WEBHOOK_SIGNING_SECRET`. Turn on Google/GitHub sign-in again with production
   OAuth credentials (Clerk's guides walk through each).
6. **Banner host:** redeploy `workers/ad-frame/worker.js` (its allow-list now includes the domain).
7. **Adsterra:** add `wanlly.africa` as a site; **WhatsApp:** webhook URL
   `https://wanlly.africa/api/whatsapp/webhook`.

## Known issues

- **`cacheComponents` and `partialPrefetching` are off** in `next.config.ts`: with them on, every page hangs on Cloudflare with `@opennextjs/cloudflare` 1.20.9. Re-test when the adapter updates.
- **Adapter patch:** `patches/@opennextjs+cloudflare+1.20.9.patch` teaches the adapter about Next 16.4's `preview-props.json`. It's applied automatically by `patch-package` on every `npm install`. Remove it once the adapter includes the fix.
- **No proxy (middleware), on purpose.** On the free plan each request gets about 10 ms of CPU; a Clerk check before every page exceeded it (error 1102). Pages redirect signed-out visitors in the browser; every API route verifies the Clerk session on the server (`src/lib/session.ts`) before touching data. Keep it that way: never trust the browser for data.
- **Size:** about 1.7 MB gzipped; the free plan allows 3 MB, Workers Paid ($5/month) 10 MB.

## Local checks

```bash
npm run build            # Next.js build
npm run cf:preview       # build for Cloudflare and serve locally with wrangler
```
