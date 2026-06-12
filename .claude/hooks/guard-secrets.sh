#!/usr/bin/env bash
# PreToolUse guard — block the agent from reading or writing secret files.
#
# Zitting HQ's .env files hold LIVE credentials: Plaid (real bank access),
# the Supabase service-role key, and the Anthropic API key. These must never
# pass through the agent (a key already leaked into a chat transcript once).
# Edit them by hand, outside Claude. Templates (.env.example etc.) are allowed.
#
# Exit 2 = block the tool call and tell Claude why.
set -uo pipefail

payload="$(cat)"
path="$(printf '%s' "$payload" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
except Exception:
    print("")' 2>/dev/null || true)"

[ -n "$path" ] || exit 0
base="$(basename "$path")"

case "$base" in
  .env.example|.env.sample|.env.template|.env.*.example)
    exit 0 ;;
  .env|.env.*)
    echo "BLOCKED: $base holds live secrets (Plaid / Supabase service-role / Anthropic API key)." >&2
    echo "Open it directly in your editor — the agent must not read or modify env files." >&2
    exit 2 ;;
esac

exit 0
