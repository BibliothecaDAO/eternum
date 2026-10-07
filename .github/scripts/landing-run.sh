#!/usr/bin/env bash
# Refuses to publish a commit unless a landing validation run of it is green: a push to next, the only run that selects
# every area. A pull request runs only the areas its diff selects, so its green run proves nothing about the rest, and a
# commit merged to next is a different commit from the pull request's head. A newer merge to next cancels the
# run of the commit before it, so only the newest commit of a burst is guaranteed a run; a commit whose run was
# cancelled is refused with that reason and the run to re-run.
# Inputs (environment): REPO, SHA, and GH_TOKEN for gh.
set -euo pipefail

runs=$(gh run list -R "$REPO" --workflow validation.yml --commit "$SHA" --event push --branch next \
  --json databaseId,conclusion)
if jq -e 'any(.[]; .conclusion == "success")' <<< "$runs" > /dev/null; then
  echo "$SHA passed its landing validation on next"
  exit 0
fi
run=$(jq -r '[.[] | select(.conclusion == "cancelled") | .databaseId] | first // empty' <<< "$runs")
if [ -n "$run" ]; then
  echo "::error::$SHA has no green landing validation run: a newer merge to next cancelled its run ($run). Only the newest commit of a burst of merges is guaranteed a run; publish that commit, or run 'gh run rerun $run' once no newer run on next is in progress and publish this one when it is green"
  exit 1
fi
echo "::error::$SHA has no green landing validation run (a push to next); publish only a landed, validated head"
exit 1
