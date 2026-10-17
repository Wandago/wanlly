# Wanlly

A free, ad-supported AI workspace (Chat, Code, Design, Images) where credits come from opt-in sponsor spots.

**Rules of work are in `HARNESS.md`. Read it before changing anything.**
Verify with `scripts/check.sh`. Exit code 0 is the only proof a task is done.

## Map

Read only the file the current step needs.

- `HARNESS.md`: operating contract (scope, forbidden actions, verification, escalation)
- `docs/status.md`: where the project stands now: phase, next step, open bugs and questions. Read this first in a new session.
- `docs/decisions.md`: accepted architecture decisions (`D-NNN`). Check here before proposing a stack or design change.
- `docs/PLAN.md`: full build plan (stack, phases 0–8, money). Read only the section for the current phase.
- `docs/harness/contract.md`: template for turning a request into a bounded task
- `docs/harness/two-pass.md`: execution pass and adversarial review pass prompts
- `prototype/index.html`: clickable UI reference. Design tokens are at the top of `<style>`, app logic in `<script>`.
- `scripts/check.sh`: the verification command (the single sensor entry point)
- `scripts/test-harness.sh`: tests that the gates still block what they should
- `.claude/settings.json`: Claude Code permissions and hooks
- `.claude/hooks/`: `guard.py` (blocks forbidden actions), `verify_on_stop.py` (blocks "done" while checks fail)
- `.githooks/pre-commit`: runs `scripts/check.sh` before every commit
- `.github/workflows/harness.yml`: runs `scripts/check.sh` in CI
- `src/`: (planned, Phase 1) Next.js app source
- `tests/`: (planned, Phase 1) test suites

Entries marked "(planned" are skipped by the map check. Remove the marker once the path exists.

## Setup

Git hooks: `git config core.hooksPath .githooks`. The SessionStart hook does this automatically in Claude Code.
