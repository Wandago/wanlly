#!/usr/bin/env bash
# The one verification command. Prints PASS/FAIL/SKIP per check; exits 1 if any check fails.
# Used by the Stop hook, the pre-commit hook and CI. See HARNESS.md "Verification protocol".
set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || dirname "$0"/..)" || exit 1

failed=0
pass() { printf 'PASS  %s\n' "$1"; }
skip() { printf 'SKIP  %s: %s\n' "$1" "$2"; }
fail() { printf 'FAIL  %s\n' "$1"; sed 's/^/      /'; failed=1; }

# 1. map: every path in the CLAUDE.md map must exist, unless marked "(planned"
check_map() {
  local missing
  missing=$(sed -n '/^## Map/,/^## /p' CLAUDE.md \
    | grep -E '^- `' | grep -v '(planned' \
    | sed -E 's/^- `([^`]+)`.*/\1/' \
    | while read -r p; do [ -e "$p" ] || echo "CLAUDE.md map lists \`$p\` but it does not exist"; done)
  if [ -n "$missing" ]; then fail map <<<"$missing"; else pass map; fi
}

# 2. secrets: no keys or .env files in tracked or not-ignored files
check_secrets() {
  local patterns='sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|re_[A-Za-z0-9]{24,}|BEGIN ([A-Z]+ )?PRIVATE KEY'
  local hits envs
  hits=$(git ls-files -z -co --exclude-standard | xargs -0 -r grep -IEnoH "$patterns" 2>/dev/null \
    | sed -E 's/^([^:]+:[0-9]+):(.{0,12}).*/\1: \2… (looks like a secret)/')
  envs=$(git ls-files -co --exclude-standard | grep -E '(^|/)\.env(\..+)?$' | grep -vE '\.env\.example$' \
    | sed 's/$/: .env files must not be committed (add to .gitignore)/')
  if [ -n "$hits$envs" ]; then fail secrets <<<"$(printf '%s\n%s' "$hits" "$envs" | sed '/^$/d')"; else pass secrets; fi
}

# 3. decisions: D-NNN entries numbered consecutively, each with Date/Decision/Why
check_decisions() {
  local out
  out=$(python3 -I - docs/decisions.md <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
parts = re.split(r"^## (D-\d{3}): ", text, flags=re.M)[1:]
errs, expect = [], 1
for ident, body in zip(parts[0::2], parts[1::2]):
    if int(ident[2:]) != expect:
        errs.append(f"{ident}: expected D-{expect:03d} (numbers must be consecutive)")
    expect = int(ident[2:]) + 1
    for field in ("Date", "Decision", "Why"):
        if not re.search(rf"^\*\*{field}:\*\* \S", body, flags=re.M):
            errs.append(f"{ident}: missing **{field}:** line")
if not parts:
    errs.append("no ## D-NNN entries found")
print("\n".join(errs))
PY
)
  if [ -n "$out" ]; then fail decisions <<<"$out"; else pass decisions; fi
}

# 4. prototype: inline <script> blocks must parse
check_prototype() {
  if ! command -v node >/dev/null; then skip prototype "node not installed"; return; fi
  local tmp out
  tmp=$(mktemp -d)
  python3 -I - prototype/index.html "$tmp" <<'PY'
import re, sys
html = open(sys.argv[1], encoding="utf-8").read()
for i, m in enumerate(re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)):
    open(f"{sys.argv[2]}/script{i}.js", "w", encoding="utf-8").write(m.group(1))
PY
  out=$(for f in "$tmp"/*.js; do [ -e "$f" ] && node --check "$f" 2>&1; done)
  rm -rf -- "$tmp"
  if [ -n "$out" ]; then fail prototype <<<"$out"; else pass prototype; fi
}

# 5. app: once package.json exists, lint, typecheck and test are required
check_app() {
  if [ ! -f package.json ]; then skip app "no package.json yet (Phase 1 adds it)"; return; fi
  local s
  for s in lint typecheck test; do
    if ! node -e "process.exit(require('./package.json').scripts?.['$s'] ? 0 : 1)"; then
      fail "app:$s" <<<"package.json has no \"$s\" script"; continue
    fi
    local out
    if out=$(npm run -s "$s" 2>&1); then pass "app:$s"; else fail "app:$s" <<<"$(tail -n 40 <<<"$out")"; fi
  done
}

# 6. games: each game under games/ runs its own lint, scenario checker and tests
check_games() {
  local dir found=0
  for dir in games/*/; do
    [ -f "$dir/package.json" ] || continue
    found=1
    local out
    if out=$(cd "$dir" && npm run -s check 2>&1); then pass "game:$(basename "$dir")"; else fail "game:$(basename "$dir")" <<<"$(grep -E '^(not ok|FAIL|#? ?fail|.*error)' <<<"$out" | head -n 20; tail -n 15 <<<"$out")"; fi
  done
  [ "$found" = 1 ] || skip games "no games yet"
}

# 7. harness: the gates still block what they should
check_harness() {
  if [ "${HARNESS_SKIP_SELFTEST:-}" = 1 ]; then skip harness "disabled by HARNESS_SKIP_SELFTEST"; return; fi
  local out
  if out=$(scripts/test-harness.sh 2>&1); then pass harness; else fail harness <<<"$out"; fi
}

check_map
check_secrets
check_decisions
check_prototype
check_app
check_games
check_harness

if [ "$failed" = 1 ]; then echo "check.sh: FAILED"; exit 1; fi
echo "check.sh: all checks passed"
