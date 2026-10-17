# Status

Durable session memory. Keep it short and current: overwrite what's stale
rather than appending a diary.

**Last updated:** 2026-10-17

## Phase

Planning is done (`docs/PLAN.md`), the prototype is done (`prototype/index.html`), and the harness is in place.
No app code exists yet.

## Side project: Mtaa Mysteries (`games/mtaa-mysteries/`)

A playable v1 is in place: rules engine, rooms, client, 6 scenarios × 2 variants, all 10 design documents, 55 tests and a browser e2e run (`npm run e2e`). Next: private playtests and a cultural review of each scenario (see its `docs/09-roadmap.md`). Open items: a reviewed Kiswahili/Sheng blocklist, a hosting choice near East Africa, and persistence before public launch.

## Next step

Phase 0 (accounts) is manual, outside the repo. Then Phase 1, step 1: the
design tokens file, copied from the `:root` variables in the prototype. Once
Phase 1 creates `package.json`, add `lint`, `typecheck` and `test` scripts.
`scripts/check.sh` picks them up automatically.

## Open questions

- Image API: OpenAI image models, Google Imagen, or Flux on Workers AI (decide before Phase 5)
- Code sandbox: E2B, Cloudflare Sandbox, or Claude Managed Agents (decide in Phase 7)

## Known bugs

None recorded.
