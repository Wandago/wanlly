# Decisions

Accepted architecture choices. Append new entries; don't rewrite old ones. To
reverse a decision, add a new entry that says `Supersedes: D-NNN`.

Format (checked by `scripts/check.sh`): a `## D-NNN: Title` heading with
consecutive numbers, plus `**Date:**`, `**Decision:**` and `**Why:**` lines.

## D-001: Hosting on Cloudflare Workers/Pages
**Date:** 2026-10-12
**Decision:** Next.js (App Router, TypeScript) deployed to Cloudflare with the OpenNext adapter.
**Why:** The free plan allows commercial use, and waiting on a model stream doesn't count against the 10 ms CPU limit. Vercel's free plan bans commercial use.

## D-002: Data, auth, files and email providers
**Date:** 2026-10-12
**Decision:** Neon Postgres via Drizzle, Clerk for auth (with a `user.created` webhook into Neon), Cloudflare R2 for files, Resend for product email.
**Why:** All have usable free tiers. R2 has no egress fees. Clerk sends its own sign-in mail, so Resend only carries product email.

## D-003: The ledger is the source of truth for credits
**Date:** 2026-10-12
**Decision:** Credits = sum of `ledger_entries`. No stored balance the browser can edit. Charge from the token usage the API reports, refund on errors.
**Why:** A client-held balance is trivially forged, and estimates drift from real cost.

## D-004: The server grants ad rewards
**Date:** 2026-10-12
**Decision:** Credits are added only after the ad network's server confirms the view, with per-day caps and cooldowns.
**Why:** Bots are the fastest way to lose money.

## D-005: Sponsors stay outside model output
**Date:** 2026-10-12
**Decision:** Sponsors never appear inside a model's answer and never change it. Every ad is labeled and optional. Nobody is blocked once a result is ready.
**Why:** Trust in the answers is the product.

## D-006: Haiku 5.5 is the free default
**Date:** 2026-10-12
**Decision:** Free users get Haiku 5.5. Bigger models cost earned credits or need Plus. Code mode is credits or Plus only, with a token budget per run.
**Why:** AI usage is the only cost that grows with every user.

## D-007: Official provider APIs only
**Date:** 2026-10-12
**Decision:** Use each provider's official SDK behind our own `providers/` router. No proxying consumer subscriptions.
**Why:** Proxying subscriptions breaks provider terms and can be shut off without notice.

## D-008: Harness-first workflow
**Date:** 2026-10-17
**Decision:** Work follows `HARNESS.md`. Every rule has a written form and a mechanical gate (Claude Code hooks, git pre-commit, CI). `scripts/check.sh` is the only definition of "verified".
**Why:** Rewording prompts doesn't stop a model from skipping verification or claiming success on broken work. A gate that blocks the run does.

## D-009: Mtaa Mysteries lives in games/ with no dependencies
**Date:** 2026-10-17
**Decision:** The murder-mystery game is a self-contained project in `games/mtaa-mysteries/`: Node standard library only, Server-Sent Events plus POST, a vanilla JS client, and JSON scenarios proved fair by a checker. `scripts/check.sh` runs its `npm run check`.
**Why:** It is unrelated to Wanlly's product, so it stays isolated and easy to move to its own repo. No dependencies means no unverified packages (HARNESS.md), and the checker turns "every mystery is solvable" into a gate instead of a hope.
