#!/usr/bin/env bash
input=$(cat)
session=$(jq -r '.session_id' <<<"$input")
active=$(jq -r '.stop_hook_active // false' <<<"$input")
marker="${TMPDIR:-/tmp}/claude-stop-checks-$session"

if [ "$active" != true ]; then
  rm -f "$marker"
  jq -n '{decision:"block",reason:"Check (if not already done) whether your latest code changes comply with CLAUDE.md. Fix violations. Docs and planning files are not code. No code changes → reply only: Code check: no changes ✓. Otherwise → Code check passed ✓."}'
elif [ ! -e "$marker" ]; then
  # Without a marker every later stop would block again, so let this one through.
  touch "$marker" || exit 0
  jq -n '{decision:"block",reason:"Now check your latest code changes for security vulnerabilities, common ones and any your changes introduced. Fix them. No code changes → reply only: Security check: no changes ✓. Otherwise → Security check passed ✓."}'
else
  rm -f "$marker"
fi
