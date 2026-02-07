#!/usr/bin/env bash

# ralph-loop.sh

set -euo pipefail

iterations=50
codex_command="codex"
ralph_prompt="Look through the plan in /docs/custom/plan.md and /docs/custom/codex-app.md Work to bring the app to completion. If the core is complete focus on verifying ui. If you have verified, find things to refactor or improve using your skills. When done create a commit and push. "

if ! command -v "$codex_command" >/dev/null 2>&1; then
  echo "Could not find '$codex_command' in PATH." >&2
  exit 1
fi

echo "Starting Ralph Loop for $iterations iterations..."
echo "Using command from PATH: $codex_command exec --yolo"

for ((i = 1; i <= iterations; i++)); do
  echo ""
  echo "----------------------------------------"
  echo "Ralph Cycle: $i of $iterations"
  echo "----------------------------------------"

  "$codex_command" exec --yolo "$ralph_prompt"
  exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo "Codex exited with code $exit_code on cycle $i." >&2
    exit "$exit_code"
  fi

  echo ""
  echo "Cycle $i complete."
  sleep 3
done

echo ""
echo "Ralph Loop sequence finished."
clear
