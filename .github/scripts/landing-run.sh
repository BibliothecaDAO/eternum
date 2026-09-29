#!/usr/bin/env bash
# Refuses to publish a commit unless a landing validation run of it is green: a push to the integration branch or
# next, the only runs that select every area (validation.yml's `landing`). A stream-branch push or a pull request runs
# only the areas its diff selects, so its green run proves nothing about the rest.
# Inputs (environment): REPO, SHA, and GH_TOKEN for gh.
set -euo pipefail

for branch in native-world-foundation next; do
  runs=$(gh run list -R "$REPO" --workflow validation.yml --commit "$SHA" --event push --branch "$branch" \
    --status success --json databaseId --jq length)
  if [ "$runs" -gt 0 ]; then
    echo "$SHA passed its landing validation on $branch"
    exit 0
  fi
done
echo "::error::$SHA has no green landing validation run (a push to native-world-foundation or next); publish only a landed, validated head"
exit 1
