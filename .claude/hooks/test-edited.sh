#!/usr/bin/env bash
# PostToolUse — run the sibling test file for whatever the agent just edited.
#
# This repo has a strong unit-test culture: the pure logic in src/db/** and
# src/lib/** each ships a co-located <name>.test.ts (forecast, allowance,
# receiptMatch, celebrations, receiptSearch, …). A single file runs in ~0.4s,
# so checking it on every edit is essentially free and catches a broken
# matcher/forecast the moment it happens — not at the final gate, and not in
# another tab an hour later.
#
# Scope is deliberately narrow: only fires when the edited file (or its
# sibling) is a real test. UI/screen edits with no tests are skipped silently.
# A failing test exits 2 so the agent sees the failure and fixes it.
set -uo pipefail

payload="$(cat)"
path="$(printf '%s' "$payload" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
except Exception:
    print("")' 2>/dev/null || true)"

[ -n "$path" ] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$path")" rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$root" ] || exit 0
bin="$root/node_modules/.bin/vitest"
[ -x "$bin" ] || exit 0

# Resolve which test file to run.
case "$path" in
  *.test.ts|*.test.tsx) target="$path" ;;
  *.ts|*.tsx)
    base="${path%.*}"
    if   [ -f "$base.test.ts" ];  then target="$base.test.ts"
    elif [ -f "$base.test.tsx" ]; then target="$base.test.tsx"
    else exit 0   # source file with no co-located test — nothing to run
    fi ;;
  *) exit 0 ;;
esac

if out="$(cd "$root" && "$bin" run "$target" 2>&1)"; then
  exit 0
fi

echo "Tests failing after editing $(basename "$path") — $(basename "$target"):" >&2
echo "$out" | tail -40 >&2
exit 2
