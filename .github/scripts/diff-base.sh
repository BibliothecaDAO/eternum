#!/usr/bin/env bash
# Prints the commit a run's changes are measured from, fetching only the history that measurement needs: the scope job
# checks out one shallow commit. A pull request is measured from where its head branched from its base (their
# merge-base), so changes the base gained after the branch was cut are not counted as the pull request's own. A stream
# branch lands every commit it carries, so its run must cover all of them: it is measured from its merge-base with the
# integration branch, never only from its last push. The integration branch and next run every area, so their base is
# never read. Prints nothing when no base can be resolved; the caller then runs every area, which checks more, never
# less.
# Inputs (environment): EVENT, PR_BASE_SHA, HEAD_SHA; LANDING_BRANCH defaults to the integration branch.
set -euo pipefail

landing=${LANDING_BRANCH:-native-world-foundation}

# Commits and trees only: a list of changed paths never reads a file's contents. Unshallowing also gives the checked-out
# commit its history.
fetch_history() {
  local deepen=()
  [ "$(git rev-parse --is-shallow-repository)" = true ] && deepen=(--unshallow)
  git fetch --quiet --no-tags --filter=blob:none "${deepen[@]}" origin "$@" 2>/dev/null
}

base=""
if [ "$EVENT" = pull_request ]; then
  if fetch_history "$PR_BASE_SHA" "$HEAD_SHA"; then
    base=$(git merge-base "$PR_BASE_SHA" "$HEAD_SHA" 2>/dev/null || true)
  fi
elif fetch_history "$landing"; then
  base=$(git merge-base "$HEAD_SHA" FETCH_HEAD 2>/dev/null || true)
fi
echo "$base"
