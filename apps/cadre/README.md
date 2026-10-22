# Cadre console

The web app where a shop owner sets Cadre up: their shop, connections, which agents are on, and the activity log. Day to day, Cadre talks to them on WhatsApp. The design and build plan are in [`docs/cadre/ARCHITECTURE.md`](../../docs/cadre/ARCHITECTURE.md).

Stack: Next.js 16 on Cloudflare Workers (OpenNext), Clerk Organizations, Neon Postgres with row-level security, Tailwind with the shared Wanlly tokens (`packages/ui`). Everything runs on free plans.

## What phase 0 includes

- Sign-up and sign-in (Clerk). Each shop is a Clerk organisation; Clerk's admin role maps to owner, member to manager.
- A shop and its member rows are created on first visit, with Chief, Finance and Inbox turned on.
- The console: setup checklist, connections, your cadre (with working on/off switches), activity.
- Shop details in Settings.
- An append-only, hash-chained audit log, checked on the Activity page.
- Row-level security on every table. The app connects as a role that can only see the shop set for the current transaction.

Connections, WhatsApp and approval rules show as "Coming soon" until their phase is built.

## Run it locally

You need Node 22, pnpm 10 and Postgres 16.

```sh
pnpm install                       # from the repo root
cp apps/cadre/.env.example apps/cadre/.env.local
```

1. **Clerk:** create a free application, turn on **Organizations**, and put its keys in `.env.local`.
2. **Database:** create a database, then run the migrations as its owner:
   ```sh
   cd apps/cadre
   DATABASE_MIGRATION_URL=postgres://owner:pass@localhost:5432/cadre pnpm db:migrate
   ```
3. **App login role:** the app must not connect as the owner, or row-level security won't apply. Create a login role and give it the app's rights:
   ```sql
   create role cadre_app_login login password 'choose-one';
   grant cadre_app to cadre_app_login;
   ```
   Set `DATABASE_URL` to connect as `cadre_app_login`.
4. `pnpm dev`, then open http://localhost:3000.

To work on the console UI without Clerk or a database, open http://localhost:3000/dev/console (development only).

## Tests

```sh
pnpm test                                  # unit tests only
TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/cadre_test pnpm test
```

With `TEST_DATABASE_ADMIN_URL` set (a superuser on a throwaway database; the tests wipe it), the database tests also run: shop isolation, the audit chain under concurrent writes, tamper detection, and that the app can't edit or delete the log.

## Deploy to Cloudflare (free plan)

1. **Neon:** create a free project. Run `pnpm db:migrate` with the owner connection string, then create `cadre_app_login` as in step 3 above (Neon's SQL editor works).
2. **Secrets:**
   ```sh
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put CLERK_SECRET_KEY
   ```
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is read at build time, so set it in the shell (or `.env.production`) before building.
3. `pnpm cf:deploy`. Your console is live on `cadre.<your-account>.workers.dev`.
4. Add that URL to the allowed origins in Clerk.

`pnpm cf:preview` runs the Workers build locally first. Put local secrets in `.dev.vars`, which is ignored by git.
