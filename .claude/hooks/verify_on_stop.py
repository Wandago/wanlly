#!/usr/bin/env python3
"""Stop gate: the mechanical half of HARNESS.md "Verification protocol" and "Failure escalation".

When the turn leaves uncommitted or unpushed work, run scripts/check.sh. If it
fails, block the stop and hand the output back to the model. After the same
failure twice, or four failures in total, block one last time with escalation
instructions, then let the turn end and tell the user. `--reset` (wired to
UserPromptSubmit) clears the budget when the user replies.
"""
import hashlib
import json
import os
import subprocess
import sys

MAX_SAME, MAX_TOTAL = 2, 4


def git(project, *args):
    r = subprocess.run(["git", *args], cwd=project, capture_output=True, text=True, timeout=30)
    return r.stdout.strip() if r.returncode == 0 else ""


def has_work(project):
    if git(project, "status", "--porcelain"):
        return True
    return git(project, "rev-list", "--count", "HEAD", "--not", "--remotes") not in ("", "0")


def main():
    project = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    state_path = os.path.join(project, ".claude", "state", "verify.json")

    if "--reset" in sys.argv:
        if os.path.exists(state_path):
            os.remove(state_path)
        return

    if not has_work(project):
        return

    cmd = os.environ.get("HARNESS_CHECK_CMD") or os.path.join(project, "scripts", "check.sh")
    try:
        r = subprocess.run(cmd, shell=True, cwd=project, capture_output=True, text=True, timeout=600)
        ok, output = r.returncode == 0, r.stdout + r.stderr
    except subprocess.TimeoutExpired:
        ok, output = False, "FAIL  scripts/check.sh timed out after 600s"

    if ok:
        if os.path.exists(state_path):
            os.remove(state_path)
        return

    try:
        with open(state_path) as f:
            state = json.load(f)
    except (OSError, ValueError):
        state = {}
    fails = "\n".join(l for l in output.splitlines() if l.startswith("FAIL")) or output
    sig = hashlib.sha1(fails.encode()).hexdigest()
    same = state.get("same", 0) + 1 if state.get("sig") == sig else 1
    total = state.get("total", 0) + 1
    escalated = state.get("escalated", False)
    tail = "\n".join(output.splitlines()[-60:])

    if escalated:
        result = {"systemMessage": "scripts/check.sh is still failing. Autonomous fixing stopped "
                                   "per HARNESS.md; waiting for your decision."}
    elif same >= MAX_SAME or total >= MAX_TOTAL:
        escalated = True
        result = {"decision": "block", "reason": (
            f"ESCALATE (HARNESS.md failure escalation): scripts/check.sh failed {total} times"
            f"{', the same error twice' if same >= MAX_SAME else ''}. Stop editing files. In your reply: "
            "print the exact error log below, state the fix you propose, and ask the user to confirm. "
            "Do not claim the task is done.\n\n" + tail)}
    else:
        result = {"decision": "block", "reason": (
            f"scripts/check.sh failed (attempt {total}/{MAX_TOTAL}). The task is not done. "
            "Fix the cause, re-run scripts/check.sh, and only then finish.\n\n" + tail)}

    os.makedirs(os.path.dirname(state_path), exist_ok=True)
    with open(state_path, "w") as f:
        json.dump({"sig": sig, "same": same, "total": total, "escalated": escalated}, f)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
