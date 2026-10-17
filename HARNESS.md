# Project Operating Contract

Every rule here is written twice: once in words (this file) and once as a
mechanical gate. The words explain the goal. The gate is what actually stops a
broken run. If you change a rule, change both sides. The "Gate" column names
where each rule is enforced.

## Operating boundaries

| Rule | Gate |
|---|---|
| Modify only files the current task contract assigns. List anything else you need to touch under the contract's "Scope change" heading and ask first. | Review pass (`docs/harness/two-pass.md`) |
| Never delete existing tests. Fix them or ask. | `.claude/hooks/guard.py` blocks `rm`/`git rm` on test files |
| Never add a dependency without the user confirming it. | `guard.py` turns `npm/pnpm/yarn add`, `npm install <pkg>`, `pip install` into a confirmation prompt |
| Never edit or read secrets. They live in Cloudflare secrets and `.env.local` only. | `guard.py` blocks edits to `.env*`; `.claude/settings.json` denies reads; `scripts/check.sh` scans for keys |
| Never `rm -rf`, force-push, push to `main`, or bypass git hooks with `--no-verify`. | `guard.py` blocks the command |
| Don't weaken the harness to make a run pass. | `guard.py` asks the user before any edit to `HARNESS.md`, `scripts/`, `.claude/`, `.githooks/`, `.github/workflows/` |

## Project map

Start at `CLAUDE.md`. It lists where everything lives. Read the single file a
step needs, not the whole tree.

## Verification protocol

Before saying a task is done, run:

```
scripts/check.sh
```

It's the only verification command, and it prints `PASS`/`FAIL`/`SKIP` per check:

1. **map**: every path in the `CLAUDE.md` map exists
2. **secrets**: no API keys or `.env` files in tracked or staged files
3. **decisions**: `docs/decisions.md` entries are well-formed
4. **prototype**: the inline JavaScript in `prototype/index.html` parses
5. **app**: `npm run lint`, `npm run typecheck` and `npm test`, once a `package.json` exists
6. **harness**: the gates themselves still block what they should (`scripts/test-harness.sh`)

Then check the deliverable against the task contract's acceptance criteria, one
by one, and quote the evidence (command output, file path, line).

"Done" means the exit code was 0 *and* every acceptance criterion has evidence.
"It should work" is not evidence.

Gates: the Stop hook (`.claude/hooks/verify_on_stop.py`) runs `scripts/check.sh`
whenever the turn leaves uncommitted or unpushed work. The pre-commit hook
(`.githooks/pre-commit`) and CI (`.github/workflows/harness.yml`) run it too.

## Failure escalation

If verification fails twice with the same error, or four times in total:

- Stop editing on your own
- Print the exact error log
- State the fix you propose and wait for the user to confirm

Gate: the Stop hook counts failures in `.claude/state/` (gitignored). On the
second identical failure, or the fourth in total, it stops asking for fixes and
hands over to the user. The counter resets when the user sends a new message.

## Durable memory

Chat history is scratch space. Before ending a session, write down anything the
next session needs:

- An architecture choice that was accepted → `docs/decisions.md` (new `D-NNN` entry)
- Current phase, next step, open bugs, open questions → `docs/status.md`
- A new location worth knowing → the map in `CLAUDE.md`
