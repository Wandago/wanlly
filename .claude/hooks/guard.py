#!/usr/bin/env python3
"""PreToolUse gate: the mechanical half of HARNESS.md "Operating boundaries".

Exit 2 blocks the tool call (stderr goes back to the model). Printing a
permissionDecision of "ask" hands the call to the user for confirmation.
This catches mistakes, not a determined adversary: it reads the command text.
"""
import json
import os
import re
import shlex
import subprocess
import sys

TEST_PATH = re.compile(
    r"(^|/)(tests?|__tests__)/|\.(test|spec)\.[cm]?[jt]sx?$|(^|/)test_[^/]*\.py$|_test\.(py|go)$"
)
ENV_FILE = re.compile(r"(^|/)\.env(\.[\w.-]+)?$")
HARNESS_FILES = re.compile(r"^(HARNESS\.md|scripts/|\.claude/(?!state/|settings\.local\.json)|\.githooks/|\.github/workflows/)")
PROTECTED_BRANCHES = {"main", "master"}
WRAPPERS = {"sudo", "env", "nohup", "time", "command", "exec"}


def block(reason):
    print(f"Blocked by HARNESS.md: {reason}", file=sys.stderr)
    sys.exit(2)


def ask(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": f"HARNESS.md: {reason}",
    }}))
    sys.exit(0)


def is_env_file(path):
    return bool(ENV_FILE.search(path)) and not path.endswith(".env.example")


def strip_heredocs(command):
    """Drop heredoc bodies (data, not commands) and turn newlines into `;` separators."""
    out, lines, delim = [], command.split("\n"), None
    for line in lines:
        if delim is not None:
            if line.strip() == delim:
                delim = None
            continue
        out.append(line)
        m = re.search(r"<<-?\s*(['\"]?)(\w+)\1", line)
        if m:
            delim = m.group(2)
    return ";".join(out)


def segments(command):
    """Split a shell command into simple commands on ; && || | & and newlines."""
    lexer = shlex.shlex(strip_heredocs(command), posix=True, punctuation_chars=";&|")
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        tokens = list(lexer)
    except ValueError:
        tokens = command.split()
    seg = []
    for tok in tokens:
        if tok and set(tok) <= set(";&|"):
            if seg:
                yield seg
            seg = []
        else:
            seg.append(tok)
    if seg:
        yield seg


def strip_prefix(seg):
    i = 0
    while i < len(seg) and (seg[i] in WRAPPERS or re.match(r"^\w+=", seg[i])):
        i += 1
    return seg[i:]


def short_flags(args):
    return "".join(a[1:] for a in args if a.startswith("-") and not a.startswith("--"))


def current_branch(cwd):
    try:
        return subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd,
                              capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return ""


def check_rm(args):
    flags = short_flags(args)
    recursive = "r" in flags or "R" in flags or "--recursive" in args
    force = "f" in flags or "--force" in args
    if recursive and force:
        block("`rm -rf` is forbidden. Delete specific files by path, or ask the user.")
    for a in args:
        if not a.startswith("-") and TEST_PATH.search(a):
            block(f"never delete existing tests (`{a}`). Fix the test or ask the user.")


def check_git(args, cwd):
    if "--no-verify" in args:
        block("`--no-verify` bypasses the pre-commit verification gate.")
    i = 0
    while i < len(args) and args[i].startswith("-"):
        i += 2 if args[i] in ("-C", "-c") else 1
    if i >= len(args):
        return
    sub, rest = args[i], args[i + 1:]
    if sub == "commit" and "n" in short_flags(rest):
        block("`git commit -n` bypasses the pre-commit verification gate.")
    if sub == "rm":
        check_rm(rest)
    if sub == "clean" and "f" in short_flags(rest):
        block("`git clean -f` deletes untracked work. Remove specific files instead.")
    if sub == "push":
        if "--force" in rest or "f" in short_flags(rest) or any(a.startswith("+") for a in rest):
            block("force-push is forbidden. Use a merge commit, or ask the user.")
        positional = [a for a in rest if not a.startswith("-")]
        targets = {a.split(":")[-1].removeprefix("refs/heads/") for a in positional[1:]}
        if targets & PROTECTED_BRANCHES:
            block("never push to main/master. Push a feature branch and open a pull request.")
        if len(positional) <= 1 and current_branch(cwd) in PROTECTED_BRANCHES:
            block("you are on main/master. Push a feature branch and open a pull request.")


def check_install(cmd, args):
    if not args:
        return
    sub, rest = args[0], args[1:]
    packages = [a for a in rest if not a.startswith("-")]
    if cmd in ("npm", "pnpm", "yarn", "bun") and sub in ("install", "i", "add") and packages:
        ask(f"adding dependencies {packages} needs the user's confirmation.")
    if cmd in ("pip", "pip3", "uv") and "install" in args and "-r" not in args:
        ask("adding Python dependencies needs the user's confirmation.")


def check_bash(command, cwd):
    for seg in segments(command):
        seg = strip_prefix(seg)
        if not seg:
            continue
        cmd, args = os.path.basename(seg[0]), seg[1:]
        if cmd == "rm":
            check_rm(args)
        elif cmd == "git":
            check_git(args, cwd)
        elif cmd == "python3" and args[:2] == ["-m", "pip"]:
            check_install("pip", args[2:])
        else:
            check_install(cmd, args)
        for a in args:
            if is_env_file(a):
                block(f"secrets stay out of the session (`{a}`). Ask the user if a value is needed.")


def check_file(path, project):
    rel = os.path.relpath(os.path.abspath(path), project) if os.path.isabs(path) else path
    if is_env_file(rel):
        block(f"never edit secrets files (`{rel}`).")
    if HARNESS_FILES.match(rel):
        ask(f"`{rel}` is part of the harness. Changing it changes the rules, so confirm it is intended.")


def main():
    data = json.load(sys.stdin)
    project = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    tool, inp = data.get("tool_name", ""), data.get("tool_input") or {}
    if tool == "Bash":
        check_bash(inp.get("command", ""), data.get("cwd") or project)
    elif tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        path = inp.get("file_path") or inp.get("notebook_path")
        if path:
            check_file(path, project)


if __name__ == "__main__":
    main()
