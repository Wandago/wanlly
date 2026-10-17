#!/usr/bin/env bash
# Tests the gates: every rule in HARNESS.md that claims a mechanical gate is exercised here.
# Run by scripts/check.sh ("harness" check).
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
guard="$root/.claude/hooks/guard.py"
stop="$root/.claude/hooks/verify_on_stop.py"
sandbox=$(mktemp -d)
trap 'rm -rf -- "$sandbox"' EXIT
git -C "$sandbox" init -q -b feature && git -C "$sandbox" -c user.name=harness -c user.email=harness@localhost commit -q --allow-empty -m init
git -C "$sandbox" update-ref refs/remotes/origin/feature HEAD  # pretend HEAD is pushed
export CLAUDE_PROJECT_DIR="$sandbox"

failures=0
expect() { # expect <block|ask|allow> <tool> <json-input-field> <value>
  local want=$1 tool=$2 field=$3 value=$4 input out code got
  input=$(python3 -I -c 'import json,sys; print(json.dumps({"tool_name":sys.argv[1],"cwd":sys.argv[4],"tool_input":{sys.argv[2]:sys.argv[3]}}))' "$tool" "$field" "$value" "$sandbox")
  out=$(python3 -I "$guard" <<<"$input" 2>/dev/null); code=$?
  if [ $code = 2 ]; then got=block; elif grep -q '"ask"' <<<"$out"; then got=ask; else got=allow; fi
  if [ "$got" != "$want" ]; then echo "guard: expected $want, got $got for $tool: $value"; failures=1; fi
}

# Forbidden commands
expect block Bash command 'rm -rf build'
expect block Bash command 'cd x && rm -r -f node_modules'
expect block Bash command 'rm tests/ledger.test.ts'
expect block Bash command 'git rm src/credits.spec.ts'
expect block Bash command 'git push --force origin feature'
expect block Bash command 'git push -fu origin feature'
expect block Bash command 'git push origin main'
expect block Bash command 'git push origin HEAD:main'
expect block Bash command 'git commit --no-verify -m x'
expect block Bash command 'git commit -nm x'
expect block Bash command 'cat .env.local'
expect block Bash command 'git clean -fd'
# Dependencies need confirmation
expect ask Bash command 'npm install left-pad'
expect ask Bash command 'pnpm add -D vitest'
expect ask Bash command 'pip install requests'
# Normal work is allowed
expect allow Bash command 'rm dist/old.js'
expect allow Bash command 'npm install'
expect allow Bash command 'npm ci'
expect allow Bash command 'git push -u origin feature'
expect allow Bash command 'git push --force-with-lease origin feature'
expect allow Bash command 'git commit -m "fix: rm -rf mention in message"'
expect allow Bash command 'scripts/check.sh'
expect allow Bash command $'git commit -F - <<\'EOF\'\nNever touch .env or run rm -rf\nEOF'
expect block Bash command $'cat <<EOF\nnote\nEOF\nrm -rf build'
# Files
expect block Write file_path '.env'
expect block Edit file_path "$sandbox/.env.production"
expect allow Write file_path '.env.example'
expect ask Edit file_path 'scripts/check.sh'
expect ask Edit file_path '.claude/settings.json'
expect ask Write file_path 'HARNESS.md'
expect allow Write file_path 'src/app/page.tsx'
expect allow Edit file_path 'tests/ledger.test.ts'

# Push from main with no explicit target
git -C "$sandbox" checkout -q -b main
expect block Bash command 'git push'
git -C "$sandbox" checkout -q feature

# Stop gate: clean tree → no check; failing check → block, then escalate, then release
stop_run() { HARNESS_CHECK_CMD="$1" python3 -I "$stop" <<<'{}'; }
stopcase() { # stopcase <name> <cmd> <expected-substring or "">
  local out; out=$(stop_run "$2")
  if [ -z "$3" ]; then [ -z "$out" ] || { echo "stop: $1: expected allow, got $out"; failures=1; }
  else grep -q -- "$3" <<<"$out" || { echo "stop: $1: expected '$3', got ${out:-allow}"; failures=1; }; fi
}
stopcase "clean tree skips checks" 'echo "FAIL x"; exit 1' ""
touch "$sandbox/work.txt"
stopcase "first failure blocks" 'echo "FAIL x"; exit 1' '"decision": "block"'
stopcase "same failure twice escalates" 'echo "FAIL x"; exit 1' 'ESCALATE'
stopcase "after escalation, stop is released" 'echo "FAIL x"; exit 1' 'systemMessage'
python3 -I "$stop" --reset <<<'{}'
stopcase "reset restores the budget" 'echo "FAIL y"; exit 1' 'attempt 1/4'
stopcase "passing check allows stop" 'true' ""
[ ! -e "$sandbox/.claude/state/verify.json" ] || { echo "stop: passing check should clear state"; failures=1; }
for i in 1 2 3; do stop_run "echo 'FAIL n$i'; exit 1" >/dev/null; done
stopcase "four different failures escalate" 'echo "FAIL n4"; exit 1' 'ESCALATE'

[ $failures = 0 ] && echo "harness gates OK"
exit $failures
