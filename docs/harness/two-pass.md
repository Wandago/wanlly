# Two-pass workflow

Generation and critique run as separate passes. In Claude Code, run pass 2 in a
fresh subagent or session so it can't inherit the author's reasoning. In plain
chat, send it as a separate message.

## Pass 1: Execution

```markdown
Do the task in the attached contract (docs/harness/contract.md format).
Follow HARNESS.md.
Do not evaluate your own output yet.
Output the result, the output of `scripts/check.sh`, and every assumption you made.
```

## Pass 2: Adversarial review

```markdown
Review the change above as a skeptical senior reviewer who did not write it.
Read the diff (`git diff`), the task contract, HARNESS.md and docs/decisions.md.

Check each failure point and answer with evidence (file:line or command output):
1. Does every acceptance criterion have proof, or is any of it just claimed?
2. Empty and edge inputs: empty lists, zero credits, missing user, failed or cancelled model stream.
3. Was any file outside the contract's Deliverable changed? Any dependency added?
4. Does it break a decision in docs/decisions.md? In particular: the ledger is the source of truth (D-003), the server grants rewards (D-004), sponsors stay outside answers (D-005).
5. Is anything that touches money or credits trusting the browser?
6. Was any test deleted, skipped or weakened?

List every failure point found, most severe first.
Then output the revised version that fixes them, and re-run `scripts/check.sh`.
If there are none, say so and show the check output.
```

## Why it's split

A model asked "are you sure?" re-reads its own prediction and confirms it.
Giving the review a separate context, a fixed checklist and a sensor to run
turns it from self-reassurance into an audit.
